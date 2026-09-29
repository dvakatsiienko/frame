import CoreGraphics
import Foundation

// Run: pnpm monitor-hotkey:test. Plain swiftc has no test framework, so a failure prints the
// case, what came out and what was expected, and the exit code turns the build red.

enum Key {
    static let cmd: Int64 = 55, rcmd: Int64 = 54, shift: Int64 = 56, opt: Int64 = 58, ctrl: Int64 = 59
}

enum Ev {
    case down(Int64, CGEventFlags)
    case up(Int64, CGEventFlags)
    case key
    // the clock moves on, in seconds
    case wait(TimeInterval)
}

// Feeds a physical sequence through the state machine and returns every bare modifier logged.
func replay(_ events: [Ev]) -> [String] {
    var bare = BareModifier()
    var logged: [String] = []
    var clock: TimeInterval = 0
    for e in events {
        switch e {
        case let .down(code, flags), let .up(code, flags):
            if let name = bare.flagsChanged(flags, code, at: clock) { logged.append(name) }
        case .key:
            bare.keyDown(at: clock)
        case let .wait(seconds):
            clock += seconds
        }
    }
    return logged
}

nonisolated(unsafe) var failures = 0

func expect<T: Equatable>(_ name: String, _ actual: T, _ expected: T) {
    guard actual != expected else { return }
    failures += 1
    print("✗ \(name)\n    got      \(actual)\n    expected \(expected)")
}

let none: CGEventFlags = []

@main
enum ChordTest {
    static func main() {
        expect("a modifier tapped alone counts once", replay([
            .down(Key.rcmd, .maskCommand), .up(Key.rcmd, none),
        ]), ["rcmd"])

        expect("a modifier with a key pressed under it does not count", replay([
            .down(Key.cmd, .maskCommand), .key, .up(Key.cmd, none),
        ]), [])

        expect("releasing the first modifier of a chord does not count the one left held", replay([
            .down(Key.shift, .maskShift), .down(Key.cmd, [.maskShift, .maskCommand]), .key,
            .up(Key.cmd, .maskShift), .up(Key.shift, none),
        ]), [])

        expect("two modifiers pressed and released with no key do not count", replay([
            .down(Key.ctrl, .maskControl), .down(Key.opt, [.maskControl, .maskAlternate]),
            .up(Key.opt, .maskControl), .up(Key.ctrl, none),
        ]), [])

        expect("the second cmd key joining the first does not count", replay([
            .down(Key.cmd, .maskCommand), .down(Key.rcmd, .maskCommand),
            .up(Key.rcmd, .maskCommand), .up(Key.cmd, none),
        ]), [])

        expect("a bare tap right after a chord still counts", replay([
            .down(Key.rcmd, .maskCommand), .key, .up(Key.rcmd, none),
            .down(Key.rcmd, .maskCommand), .up(Key.rcmd, none),
        ]), ["rcmd"])

        expect("an unbound bare modifier is not logged", replay([
            .down(Key.cmd, .maskCommand), .up(Key.cmd, none),
            .down(Key.opt, .maskAlternate), .up(Key.opt, none),
        ]), [])

        expect("rcmd held past the hold-to-talk line counts though keys arrive under it", replay([
            .down(Key.rcmd, .maskCommand), .wait(0.4), .key, .key, .up(Key.rcmd, none),
        ]), ["rcmd"])

        expect("rcmd with a key inside the hold-to-talk line is a chord, not a press", replay([
            .down(Key.rcmd, .maskCommand), .wait(0.1), .key, .up(Key.rcmd, none),
        ]), [])

        expect("opt on a digit is a typed character", chordFor(.maskAlternate, 25), nil)
        expect("opt+shift on a symbol is a typed character", chordFor([.maskAlternate, .maskShift], 27), nil)
        expect("a bound opt digit still logs", chordFor(.maskAlternate, 18), "opt+1")
        expect("opt on a non-printable key logs", chordFor(.maskAlternate, 51), "opt+backspace")

        let bindings = Bindings([
            Binding(mods: "", key: "f4", action: "read", feature: "read aloud", scope: nil, until: nil),
            Binding(mods: "", key: "esc", action: "dismiss", feature: nil, scope: nil, until: nil),
            Binding(mods: "", key: "esc", action: "hideToasts", feature: nil, scope: ["cursor.app"], until: nil),
            Binding(mods: "opt", key: "esc", action: "speak", feature: "read aloud", scope: nil, until: "2026-09-28"),
        ], now: "2026-09-29T22:41")
        expect("a press takes its binding's feature", bindings.feature(of: "f4", in: "any"), "read aloud")
        expect("an unset feature falls back to the action", bindings.feature(of: "esc", in: "chrome"), "dismiss")
        expect("an in-app binding wins inside its app", bindings.feature(of: "esc", in: "cursor.app"), "hideToasts")
        expect("an ended binding stamps nothing", bindings.feature(of: "opt+esc", in: "any"), nil)

        expect("bare f1 logs", chordFor(none, 122), "f1")
        expect("bare f12 logs", chordFor(none, 111), "f12")
        expect("bare esc logs", chordFor(none, 53), "esc")
        expect("a bare letter is dropped", chordFor(none, 0), nil)
        expect("a shifted letter is dropped", chordFor(.maskShift, 0), nil)
        expect("a bare digit is dropped", chordFor(none, 18), nil)
        expect("a bare symbol is dropped", chordFor(none, 44), nil)
        expect("bare return is dropped", chordFor(none, 36), nil)
        expect("bare f13 is dropped", chordFor(none, 105), nil)
        expect("a modifier chord still logs", chordFor([.maskShift, .maskCommand], 21), "shift+cmd+4")

        if failures > 0 {
            print("x-monitor-hotkey-stats: \(failures) failed")
            exit(1)
        }
        print("x-monitor-hotkey-stats: all passed")
    }
}
