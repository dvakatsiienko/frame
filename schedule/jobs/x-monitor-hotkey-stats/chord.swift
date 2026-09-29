import CoreGraphics
import Foundation

// Keys that are never typing, so they may reach disk with no modifier held. Bare F1–F4 are
// homerow and read-aloud bindings, bare esc is wispr's cancel. A letter, digit or symbol never
// joins this set: a bare one of those is a keystroke, and keystrokes are what this daemon
// promises not to record.
let bareKeys: Set<String> = [
    "esc", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
]

// ⌥ and ⌥⇧ on a printable key type a character on the birman layout (opt+- is —, opt+9 is →):
// that is typing, and it never reaches disk. The ⌥ bindings on printable keys are named here —
// a new one joins this set, or its presses go unrecorded.
let optBoundKeys: Set<String> = ["1", "2", "3"]

func isPrintable(_ key: String) -> Bool { key.count == 1 || key == "space" }

// Canonical modifier order, identical to `modOrder` in hotkeys/chord.ts:
// hyper, ctrl, opt, shift, cmd. All four together collapse to `hyper`.
// `fn` and caps lock are deliberately absent — fn rides every arrow and function key, and
// caps lock is a lock state, so either one would fork one chord into two spellings.
func chordFor(_ flags: CGEventFlags, _ keyCode: Int64) -> String? {
    let ctrl = flags.contains(.maskControl)
    let opt = flags.contains(.maskAlternate)
    let shift = flags.contains(.maskShift)
    let cmd = flags.contains(.maskCommand)
    let key = keyCap[keyCode] ?? "key\(keyCode)"

    // Shift alone is typing, never a hotkey. This is the privacy gate.
    guard ctrl || opt || cmd || bareKeys.contains(key) else { return nil }
    // ⌥-typing, the same privacy gate one layer up
    if opt && !ctrl && !cmd && isPrintable(key) && !optBoundKeys.contains(key) { return nil }

    var parts: [String] = []
    if ctrl && opt && shift && cmd {
        parts.append("hyper")
    } else {
        if ctrl { parts.append("ctrl") }
        if opt { parts.append("opt") }
        if shift { parts.append("shift") }
        if cmd { parts.append("cmd") }
    }
    parts.append(key)
    return parts.joined(separator: "+")
}

// A modifier pressed alone can be a binding in its own right — wispr flow's push-to-talk is
// bare right cmd, and its previous one was bare ctrl. Those never produce a keyDown, so the
// chord has to be read from the flagsChanged stream instead.
//
// It counts only when the modifier went down from an empty state and came back up with nothing
// else pressed or joined in between. The "from empty" half is what stops a chord's release from
// counting: letting go of cmd first out of shift+cmd+4 leaves shift held alone, which looked
// like a fresh bare press and logged `cmd` when shift came up. About a third of all bare `cmd`
// lines were that (measured on the 2026-09 log).
//
// The keycode is the only thing that tells left from right. CGEventFlags cannot: maskCommand
// is identical for both cmd keys, which is why the name is keyed on the code and not the flags.
let modifierName: [Int64: String] = [
    54: "rcmd", 55: "cmd", 56: "shift", 58: "opt",
    59: "ctrl", 60: "rshift", 61: "ropt", 62: "rctrl",
]

// Only a bare modifier something listens for is a press worth keeping. Every other one is a
// ⌘-click, an opt-drag or a chord let go half-way: 3,269 bare `cmd`, 1,546 `opt` and 1,472
// `ctrl` in the first 16 days, none of them bound. Binding a new bare modifier means adding it
// here — the history for it starts that day.
let boundBareModifiers: Set<String> = ["rcmd"]

// Held this long, a modifier is push-to-talk rather than the start of a chord: wispr types the
// transcript while rcmd is still down, and those synthetic keys must not cancel the press.
let holdToTalk: TimeInterval = 0.3

struct BareModifier {
    private var pending: String?
    private var downAt: TimeInterval = 0
    private var heldCount = 0

    // Returns the bare modifier to log, if this event completed one. `time` is the event's own
    // clock in seconds; only differences are read.
    mutating func flagsChanged(_ flags: CGEventFlags, _ keyCode: Int64, at time: TimeInterval) -> String? {
        let held = [CGEventFlags.maskControl, .maskAlternate, .maskShift, .maskCommand]
            .filter { flags.contains($0) }.count
        defer { heldCount = held }

        if held == 0 {
            defer { pending = nil }
            return pending
        }
        let name = held == 1 && heldCount == 0 ? modifierName[keyCode] : nil
        pending = name.flatMap { boundBareModifiers.contains($0) ? $0 : nil }
        downAt = time
        return nil
    }

    mutating func keyDown(at time: TimeInterval) {
        if time - downAt < holdToTalk { pending = nil }
    }
}

// What a press did, stamped onto its line so the log carries its own meaning: a rebind needs no
// ended binding kept around to explain the presses before it. Read from hotkeys/hotkeys.json —
// the live rows only — and resolved the way the page labels: an in-app row (its `scope` holds
// the frontmost bundle) wins over a global one on the same chord.
struct Binding: Decodable {
    let mods: String
    let key: String
    let action: String
    let feature: String?
    let scope: [String]?
    let until: String?

    var chord: String { mods.isEmpty ? key : "\(mods)+\(key)" }
}

struct Bindings {
    private var byChord: [String: [Binding]] = [:]

    // `now` is the local minute, the same clock `until` is written in
    init(_ rows: [Binding], now: String) {
        for row in rows where row.until.map({ $0 > now }) ?? true {
            byChord[row.chord, default: []].append(row)
        }
    }

    func feature(of chord: String, in app: String) -> String? {
        let fits = (byChord[chord] ?? []).filter { $0.scope?.contains(app) ?? true }
        let row = fits.first { $0.scope != nil } ?? fits.first
        return row.map { $0.feature ?? $0.action }
    }
}
