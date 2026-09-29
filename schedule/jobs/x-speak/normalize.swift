// voices read prose well and tech text badly: ids, versions, paths, code and symbols come out as
// «vee zero three eighty-five» or a spelled url. no engine fixes this for us (FRM-269 research),
// so every engine is fed text rewritten here first. golden.json is the contract.
import Foundation

enum Lang: String, Codable { case en, uk, ru }

struct Run: Equatable {
    var lang: Lang
    var text: String
}

private let letterAcronyms: Set = ["api", "cli", "css", "html", "mcp", "npm", "pnpm", "pr", "sdk", "ssh", "tts", "ui", "url", "ux"]
private let wordAcronyms = ["json": "jason", "sql": "sequel", "yaml": "yammel"]
private let units = ["gb": "gigabytes", "s": "seconds", "hz": "hertz", "kb": "kilobytes", "khz": "kilohertz", "mb": "megabytes", "ms": "milliseconds", "px": "pixels"]
private let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

private func spell(_ letters: String) -> String { letters.uppercased().map(String.init).joined(separator: " ") }

// every match is handed to `replace` as [whole, group1, group2, …]; an unmatched group is ""
private func sub(_ text: String, _ pattern: String, _ options: NSRegularExpression.Options = [], _ replace: ([String]) -> String) -> String {
    let regex = try! NSRegularExpression(pattern: pattern, options: options)
    var result = text
    for match in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed() {
        let groups = (0..<match.numberOfRanges).map { i in
            Range(match.range(at: i), in: text).map { String(text[$0]) } ?? ""
        }
        result.replaceSubrange(Range(match.range, in: result)!, with: replace(groups))
    }
    return result
}

private func sub(_ text: String, _ pattern: String, _ template: String, _ options: NSRegularExpression.Options = []) -> String {
    try! NSRegularExpression(pattern: pattern, options: options)
        .stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: template)
}

private func stripMarkdown(_ text: String) -> String {
    var t = text
    t = sub(t, "```[\\s\\S]*?```", " code block. ")
    t = sub(t, "!\\[[^\\]]*\\]\\([^)]*\\)", "")
    t = sub(t, "\\[([^\\]]+)\\]\\([^)]*\\)", "$1")
    t = sub(t, "^\\s{0,3}#{1,6}\\s+", "", .anchorsMatchLines)
    t = sub(t, "^\\s*(?:[-*+]|\\d+\\.)\\s+", "", .anchorsMatchLines)
    t = sub(t, "^\\s*>\\s?", "", .anchorsMatchLines)
    t = sub(t, "(\\*\\*|__|~~|`)", "")
    t = sub(t, "(^|\\s)[*_]([^*_\\n]+)[*_](?=\\s|[.,!?]|$)", "$1$2")
    return sub(t, "[\\p{Extended_Pictographic}\\x{FE0F}\\x{200D}]", "")
}

private func rewriteLatin(_ text: String) -> String {
    var t = text
    t = sub(t, "\\bhttps?://(?:www\\.)?([^/\\s)]+)\\S*", "$1", .caseInsensitive)
    t = sub(t, "\\b(\\d{4})-(\\d{2})-(\\d{2})\\b") { g in
        guard let month = Int(g[2]), (1...12).contains(month), let day = Int(g[3]) else { return g[0] }
        return "\(months[month - 1]) \(day), \(g[1])"
    }
    t = sub(t, "\\b127\\.0\\.0\\.1\\b", "localhost")
    t = sub(t, "\\b(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\b", "$1 dot $2 dot $3 dot $4")
    t = sub(t, "\\b([A-Za-z0-9][\\w.-]*):(\\d{2,5})\\b", "$1 port $2")
    t = sub(t, "\\b([A-Z]{2,6})-(\\d+)\\b") { g in "\(spell(g[1])) \(g[2])" }
    t = sub(t, "\\bv?(\\d+(?:\\.\\d+){1,3})\\b") { g in
        let parts = g[1].split(separator: ".")
        if g[0].hasPrefix("v") { return "version " + parts.joined(separator: " point ") }
        return parts.count > 2 ? parts.joined(separator: " point ") : g[0]
    }
    t = sub(t, "(\\d)\\s?(khz|hz|ms|kb|mb|gb|px|s)\\b", .caseInsensitive) { g in "\(g[1]) \(units[g[2].lowercased()]!)" }
    t = sub(t, "(?:~|\\.{1,2})?/?(?:[\\w.-]+/)+[\\w.-]*") { g in
        g[0].split(separator: "/").filter { !["~", ".", ".."].contains($0) }.joined(separator: " ")
    }
    t = sub(t, "\\b(\\w+)\\.(ts|tsx|js|md|json|sh|py|swift|go|yaml|toml)\\b", "$1 dot $2")
    t = sub(t, "\\b(\\w+)\\.([a-z]+[A-Z]\\w*)\\b", "$1 dot $2")
    t = sub(t, "([A-Za-z]):([A-Za-z])", "$1 $2")
    t = sub(t, "([a-z])([A-Z])", "$1 $2")
    t = sub(t, "\\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\\b") { g in g[0].lowercased() }
    t = sub(t, "(\\w)_(?=\\w)", "$1 ")
    t = sub(t, "#(\\d+)", "number $1")
    return sub(t, "\\b[A-Za-z]+\\b") { g in
        let lower = g[0].lowercased()
        if letterAcronyms.contains(lower) { return spell(lower) }
        return wordAcronyms[lower] ?? g[0]
    }
}

private func rewriteSymbols(_ text: String) -> String {
    var t = text
    t = sub(t, "\\s*(?:→|->|=>|⇒|·|\\||—|–)\\s*", ", ")
    t = sub(t, "\\s&\\s", " and ")
    t = sub(t, "\\s/\\s", ", ")
    t = sub(t, "\\s@(\\w)", " at $1")
    t = sub(t, "[«»\"“”]", "")
    t = sub(t, "[()\\[\\]]", ", ")
    t = sub(t, "[{}<>*_=+^~\\\\]", " ")
    t = sub(t, "\\s+", " ")
    t = sub(t, "\\s+([.,!?;:])", "$1")
    t = sub(t, ",(\\s*,)+", ",")
    t = sub(t, "([.!?;:]),", "$1")
    return sub(t, "^[,\\s]+|[,\\s]+$", "")
}

// a run changes language only on a letter; digits, spaces and punctuation stay with the run they sit in
func splitRuns(_ text: String) -> [Run] {
    let cyrillicLang: Lang = text.range(of: "[іїєґ]", options: [.regularExpression, .caseInsensitive]) != nil ? .uk
        : text.range(of: "[ыэъё]", options: [.regularExpression, .caseInsensitive]) != nil ? .ru : .uk
    var runs: [Run] = []
    for char in text {
        let scalar = char.unicodeScalars.first!
        let lang: Lang? = char.isLetter ? (scalar.properties.isAlphabetic && (0x0400...0x052F).contains(scalar.value) ? cyrillicLang : .en) : nil
        guard var last = runs.popLast() else {
            runs.append(Run(lang: lang ?? .en, text: String(char)))
            continue
        }
        if lang == nil || lang == last.lang {
            last.text.append(char)
            runs.append(last)
        } else if !last.text.contains(where: \.isLetter) {
            last.lang = lang!
            last.text.append(char)
            runs.append(last)
        } else {
            runs.append(last)
            runs.append(Run(lang: lang!, text: String(char)))
        }
    }
    return runs
        .map { Run(lang: $0.lang, text: $0.text.trimmingCharacters(in: .whitespacesAndNewlines)) }
        .filter { $0.text.contains { $0.isLetter || $0.isNumber } }
}

func normalize(_ text: String) -> [Run] {
    splitRuns(stripMarkdown(text))
        .map { Run(lang: $0.lang, text: rewriteSymbols($0.lang == .en ? rewriteLatin($0.text) : $0.text)) }
        .filter { !$0.text.isEmpty }
}
