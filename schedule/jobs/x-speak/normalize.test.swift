// golden.json is dima's real text (tickets, commits, a url and a path mid-sentence) and what a voice
// should receive for it. usage: normalize-test <golden.json>
import Foundation

struct Case: Decodable {
    let `in`: String
    let out: [[String]]
}

@main
struct NormalizeTest {
    static func main() throws {
        let path = CommandLine.arguments[1]
        let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        var failed = 0
        for item in cases {
            let got = normalize(item.in).map { [$0.lang.rawValue, $0.text] }
            if got != item.out {
                failed += 1
                print("✗ \(item.in)\n  want \(item.out)\n  got  \(got)")
            }
        }
        print("\(cases.count - failed)/\(cases.count) golden cases pass")
        exit(failed == 0 ? 0 : 1)
    }
}
