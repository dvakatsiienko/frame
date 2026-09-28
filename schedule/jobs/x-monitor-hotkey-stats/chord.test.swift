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
}

// Feeds a physical sequence through the state machine and returns every bare modifier logged.
func replay(_ events: [Ev]) -> [String] {
    var bare = BareModifier()
    var logged: [String] = []
    for e in events {
        switch e {
        case let .down(code, flags), let .up(code, flags):
            if let name = bare.flagsChanged(flags, code) { logged.append(name) }
        case .key:
            bare.keyDown()
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
            .down(Key.opt, .maskAlternate), .key, .up(Key.opt, none),
            .down(Key.opt, .maskAlternate), .up(Key.opt, none),
        ]), ["opt"])

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
