// x-monitor-hotkey-stats — counts which chords actually get pressed, per app.
//
// Privacy by construction: a KEY event reaches disk only when cmd, ctrl or opt is held, or when
// it is esc or F1–F12 (`bareKeys` in chord.swift). Plain typing, shift+letter and every password
// field are dropped inside the callback, before anything is formatted. App switches carry a
// bundle id and nothing else — no window title, no document name. Nothing but
// {ts, kind, chord?, feature?, app} is ever written — the feature is the binding's own name.
//
// Tap placement is .cgSessionEventTap, measured on 2026-09-14: raycast's hyper key swallows
// the physical press at the HID layer and re-posts a synthetic ⌃⌥⇧⌘ event into the session.
// A .cghidEventTap therefore sees `a` with no modifiers and loses every hyper chord.

import Cocoa

// `chordFor` and the bare-modifier state machine sit in chord.swift, pure so chord.test.swift
// can replay event sequences through them. `keyCap` sits in keycodes.swift, generated from
// hotkeys/chord.ts by `pnpm monitor-hotkey:keycodes`.

final class Log {
    private var handle: FileHandle?
    private var month = ""
    private let dir: URL
    private let stamp: ISO8601DateFormatter

    init() {
        dir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".local/share/x-monitor-hotkey-stats")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        stamp = ISO8601DateFormatter()
        stamp.formatOptions = [.withInternetDateTime]
        stamp.timeZone = .current
    }

    private func handle(for date: Date) -> FileHandle? {
        let m = String(stamp.string(from: date).prefix(7))
        if m != month || handle == nil {
            try? handle?.close()
            let path = dir.appendingPathComponent("\(m).jsonl").path
            let fd = open(path, O_WRONLY | O_CREAT | O_APPEND, 0o600)
            guard fd >= 0 else {
                FileHandle.standardError.write(Data("x-monitor-hotkey-stats: cannot open \(path)\n".utf8))
                return nil
            }
            handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
            month = m
        }
        return handle
    }

    // A line written before app events existed carries no "kind"; the reader treats
    // a missing one as a chord, so today's log stays readable.
    func append(kind: String, chord: String?, app: String, feature: String? = nil) {
        let now = Date()
        guard let out = handle(for: now) else { return }
        let chordField = chord.map { #""chord":"\#(esc($0))","# } ?? ""
        let featureField = feature.map { #""feature":"\#(esc($0))","# } ?? ""
        let line = #"{"ts":"\#(stamp.string(from: now))","kind":"\#(kind)",\#(chordField)\#(featureField)"app":"\#(esc(app))"}"# + "\n"
        try? out.write(contentsOf: Data(line.utf8))
    }

    private func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }
}

let log = Log()
var tapPort: CFMachPort?

var bare = BareModifier()

// The live bindings, for stamping each press with its feature. hotkeys.json is the scan's output
// (a rebind or a config change rewrites it); it is reread when it moves, and at least once a
// minute so a binding's `until` takes effect on time. No file yet → nothing is stamped, and the
// page falls back to its own labelling.
struct Scan: Decodable { let hotkeys: [Binding] }

let bindingsFile = NSHomeDirectory() + "/frame/hotkeys/hotkeys.json"
var bindings = Bindings([], now: "")
var bindingsRead: (modified: Date?, at: Date) = (nil, .distantPast)

let minuteFormat: DateFormatter = {
    let format = DateFormatter()
    format.dateFormat = "yyyy-MM-dd'T'HH:mm"
    format.timeZone = .current
    return format
}()

func featureFor(_ chord: String, in app: String) -> String? {
    let modified = (try? FileManager.default.attributesOfItem(atPath: bindingsFile))?[.modificationDate] as? Date
    if modified != bindingsRead.modified || Date().timeIntervalSince(bindingsRead.at) > 60,
       let data = FileManager.default.contents(atPath: bindingsFile),
       let scan = try? JSONDecoder().decode(Scan.self, from: data) {
        bindings = Bindings(scan.hotkeys, now: minuteFormat.string(from: Date()))
        bindingsRead = (modified, Date())
    }
    return bindings.feature(of: chord, in: app)
}

// the event's own clock (nanoseconds since boot), for the hold-to-talk rule
func seconds(_ event: CGEvent) -> TimeInterval { Double(event.timestamp) / 1_000_000_000 }

func frontApp() -> String {
    NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "unknown"
}

let handler: CGEventTapCallBack = { _, type, event, _ in
    // macOS disables a tap that ever stalls; without this the daemon goes quietly deaf.
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let port = tapPort { CGEvent.tapEnable(tap: port, enable: true) }
        // A modifier released while the tap was off never reports its up event.
        bare = BareModifier()
        return nil
    }

    let flags = event.flags

    if type == .flagsChanged {
        if let name = bare.flagsChanged(flags, event.getIntegerValueField(.keyboardEventKeycode), at: seconds(event)) {
            let app = frontApp()
            log.append(kind: "chord", chord: name, app: app, feature: featureFor(name, in: app))
        }
        return Unmanaged.passUnretained(event)
    }

    bare.keyDown(at: seconds(event))

    // Holding a chord fires keyDown repeatedly; one press must count once.
    guard event.getIntegerValueField(.keyboardEventAutorepeat) == 0 else {
        return Unmanaged.passUnretained(event)
    }

    if let chord = chordFor(flags, event.getIntegerValueField(.keyboardEventKeycode)) {
        let app = frontApp()
        log.append(kind: "chord", chord: chord, app: app, feature: featureFor(chord, in: app))
    }
    return Unmanaged.passUnretained(event)
}

let mask = CGEventMask(
    (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.flagsChanged.rawValue))

// A listen-only tap without Input Monitoring is created fine and then receives nothing, so the
// grant is checked up front. After a rebuild the grant no longer matches the new cdhash, and
// this is the line that says so; KeepAlive retries every 30s until the re-grant lands. The
// request call is what puts a fresh binary's row into the Input Monitoring list to be ticked.
guard CGPreflightListenEventAccess() else {
    CGRequestListenEventAccess()
    FileHandle.standardError.write(Data(
        "x-monitor-hotkey-stats: no Input Monitoring for this binary — re-grant it\n".utf8))
    exit(1)
}

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: mask,
    callback: handler,
    userInfo: nil
) else {
    FileHandle.standardError.write(Data(
        "x-monitor-hotkey-stats: tap refused — grant Input Monitoring to this binary\n".utf8))
    exit(1)
}

// cmd-tab, a dock click, a window click and a raycast hotkey all land here, so a
// switch is counted however it was made.
let workspace = NSWorkspace.shared.notificationCenter
let watch = [
    (NSWorkspace.didActivateApplicationNotification, "activate"),
    (NSWorkspace.didLaunchApplicationNotification, "launch"),
]
for (name, kind) in watch {
    workspace.addObserver(forName: name, object: nil, queue: .main) { note in
        let running = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
        log.append(kind: kind, chord: nil, app: running?.bundleIdentifier ?? "unknown")
    }
}

tapPort = tap
let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), source, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)
print("x-monitor-hotkey-stats: session tap live — chords and app switches")
CFRunLoopRun()
