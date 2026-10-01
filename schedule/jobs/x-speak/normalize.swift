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
private let fileKinds = ["htm": "html", "md": "markdown", "txt": "text"]
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
    t = sub(t, "^\\s*[-*+]\\s+", "", .anchorsMatchLines)
    // a numbered line says its number, then a short pause: «1. merge» → «1: merge», read «one: merge»
    t = sub(t, "^\\s*(\\d+)\\.\\s+", "$1: ", .anchorsMatchLines)
    t = sub(t, "^\\s*>\\s?", "", .anchorsMatchLines)
    t = sub(t, "(\\*\\*|__|~~|`)", "")
    t = sub(t, "(^|\\s)[*_]([^*_\\n]+)[*_](?=\\s|[.,!?]|$)", "$1$2")
    // ➡️ is an arrow before it is a pictograph: it pauses like «→» instead of vanishing
    t = sub(t, "\\x{27A1}\\x{FE0F}?", " → ")
    // pictographs, skin tones, flags, keycaps, tag sequences and the joiners that glue them
    t = sub(t, "[\\p{Extended_Pictographic}\\p{Emoji_Modifier}\\p{Regional_Indicator}\\x{FE0E}\\x{FE0F}\\x{200D}\\x{20E3}\\x{E0020}-\\x{E007F}]", "")
    // a line that ends bare ends a sentence: several lines read as one run-on otherwise (dima: «it sounds like a single sentence»)
    return sub(t, "(?<=[\\p{L}\\p{N})\\]])[ \\t]*\\r?\\n", ".\n")
}

private func rewriteLatin(_ text: String) -> String {
    var t = text
    // ids carry nothing a listener can use: a file link names its kind, a hash, a uuid, a long token or a pid number is cut
    t = sub(t, "\\bfile://\\S*?(?:\\.(\\w+))?(?=[.,;:!?)]*(?:\\s|$))", .caseInsensitive) { g in
        let kind = fileKinds[g[1].lowercased()] ?? g[1].lowercased()
        guard let first = kind.first else { return "a file link" }
        // «an html», «a pdf», «a markdown»: a kind read letter by letter takes its article from the letter's name
        let isSpelled = letterAcronyms.contains(kind) || !kind.contains(where: "aeiou".contains)
        return ((isSpelled ? "aefhilmnorsx" : "aeiou").contains(first) ? "an " : "a ") + kind + " file link"
    }
    t = sub(t, "\\bhttps?://(?:www\\.)?([^/\\s)]+)\\S*", "$1", .caseInsensitive)
    t = sub(t, "\\b[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}\\b", "an id")
    t = sub(t, "\\b(pid)\\b\\s*[:=]?\\s*\\d+", "pid", .caseInsensitive)
    // two letters and two digits at least, so «1e10000» and «deadbeef» stay words; a «#» in front is a colour
    t = sub(t, "(?<![#\\w])(?=(?:[0-9a-f]*\\d){2})(?=(?:[0-9a-f]*[a-f]){2})(?:[0-9a-f]{7,12}|[0-9a-f]{40})\\b", "a commit")
    // six digits at least, so a type name like «ISO8601DateFormatter» stays a name
    t = sub(t, "\\b(?=(?:[A-Za-z]*\\d){6})(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{16,}\\b", "an id")
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
    // a path says only its last part; a bare «audio/video» is two words, not a path
    t = sub(t, "(?:~|\\.{1,2})?/?(?:[\\w.-]+/)+[\\w.-]*") { g in
        let parts = g[0].split(separator: "/").filter { !["~", ".", ".."].contains($0) }
        // a file name has a word before its extension («exa.md»), a version has digits («24.x»); a sentence end the
        // line-break rule put on the leaf is not an extension either
        let hasExtension = parts.last?.range(of: "[A-Za-z][\\w-]*\\.[A-Za-z]\\w*\\.?$", options: .regularExpression) != nil
        let isPath = g[0].first.map { "~./".contains($0) } == true || g[0].hasSuffix("/") || hasExtension
        return isPath ? parts.last.map(String.init) ?? "" : parts.joined(separator: " ")
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
    t = sub(t, ",([.!?;:])", "$1")
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

// chromium's accessibility text (the Claude app, electron) drops a list's line breaks and glues each number to the
// line above: «lane1. merge now2. sleep». numbers that run 1, 2, … right after a non-digit get their lines back; a
// lone glued «3.» (FRM-283.) is never a list. U+FFFC stands in for an inline image or icon and has nothing to say
private func unglueLists(_ text: String) -> String {
    var t = text.replacingOccurrences(of: "\u{FFFC}", with: "")
    var breaks: [Int] = []
    var from = t.startIndex
    for number in 1... {
        guard let found = t.range(of: "(?<=[^\\s\\d])\(number)\\. ", options: .regularExpression, range: from..<t.endIndex) else { break }
        breaks.append(t.distance(from: t.startIndex, to: found.lowerBound))
        from = found.upperBound
    }
    guard breaks.count >= 2 else { return t }
    // from the end, so each offset still points where it did
    for offset in breaks.reversed() { t.insert("\n", at: t.index(t.startIndex, offsetBy: offset)) }
    return t
}

func normalize(_ text: String) -> [Run] {
    splitRuns(stripMarkdown(unglueLists(text)))
        .map { Run(lang: $0.lang, text: rewriteSymbols($0.lang == .en ? rewriteLatin($0.text) : $0.text)) }
        .filter { !$0.text.isEmpty }
}
