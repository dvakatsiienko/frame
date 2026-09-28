// x-monitor-hotkey-stats — counts which chords actually get pressed, per app.
//
// 📌 NEXT REBUILD: a modifier HELD past ~300 ms with key events arriving while it is down should
// count once on release. That is wispr's push-to-talk on rcmd — it types the transcript while the
// key is still held, and the current down-then-up-with-no-key-between rule cancels the press.
//
// Privacy by construction: a KEY event reaches disk only when cmd, ctrl or opt is held, or when
// it is esc or F1–F12 (`bareKeys` in chord.swift). Plain typing, shift+letter and every password
// field are dropped inside the callback, before anything is formatted. App switches carry a
// bundle id and nothing else — no window title, no document name. Nothing but
// {ts, kind, chord?, app} is ever written.
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
    func append(kind: String, chord: String?, app: String) {
        let now = Date()
        guard let out = handle(for: now) else { return }
        let chordField = chord.map { #""chord":"\#(esc($0))","# } ?? ""
        let line = #"{"ts":"\#(stamp.string(from: now))","kind":"\#(kind)",\#(chordField)"app":"\#(esc(app))"}"# + "\n"
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

func frontApp() -> String {
    NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "unknown"
}

let handler: CGEventTapCallBack = { _, type, event, _ in
    // macOS disables a tap that ever stalls; without this the daemon goes quietly deaf.
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let port = tapPort { CGEvent.tapEnable(tap: port, enable: true) }
        return nil
    }

    let flags = event.flags

    if type == .flagsChanged {
        if let name = bare.flagsChanged(flags, event.getIntegerValueField(.keyboardEventKeycode)) {
            log.append(kind: "chord", chord: name, app: frontApp())
        }
        return Unmanaged.passUnretained(event)
    }

    bare.keyDown()

    // Holding a chord fires keyDown repeatedly; one press must count once.
    guard event.getIntegerValueField(.keyboardEventAutorepeat) == 0 else {
        return Unmanaged.passUnretained(event)
    }

    if let chord = chordFor(flags, event.getIntegerValueField(.keyboardEventKeycode)) {
        log.append(kind: "chord", chord: chord, app: frontApp())
    }
    return Unmanaged.passUnretained(event)
}

let mask = CGEventMask(
    (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.flagsChanged.rawValue))

// A listen-only tap without Input Monitoring is created fine and then receives nothing, so the
// grant is checked up front. After a rebuild the grant no longer matches the new cdhash, and
// this is the line that says so; KeepAlive retries every 30s until the re-grant lands.
guard CGPreflightListenEventAccess() else {
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
