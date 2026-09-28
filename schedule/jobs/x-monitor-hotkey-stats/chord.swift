import CoreGraphics

// Keys that are never typing, so they may reach disk with no modifier held. Bare F1–F4 are
// homerow and read-aloud bindings, bare esc is wispr's cancel. A letter, digit or symbol never
// joins this set: a bare one of those is a keystroke, and keystrokes are what this daemon
// promises not to record.
let bareKeys: Set<String> = [
    "esc", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
]

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

struct BareModifier {
    private var pending: String?
    private var heldCount = 0

    // Returns the bare modifier to log, if this event completed one.
    mutating func flagsChanged(_ flags: CGEventFlags, _ keyCode: Int64) -> String? {
        let held = [CGEventFlags.maskControl, .maskAlternate, .maskShift, .maskCommand]
            .filter { flags.contains($0) }.count
        defer { heldCount = held }

        if held == 0 {
            defer { pending = nil }
            return pending
        }
        pending = held == 1 && heldCount == 0 ? modifierName[keyCode] : nil
        return nil
    }

    mutating func keyDown() {
        pending = nil
    }
}
