// config.json beside this file: dima's knobs, re-read on the next F5 after a save. a bad edit logs one
// line and the last good config stays; the daemon never dies on a typo.
import Foundation

struct Config: Decodable {
    // per language, tried in order; an engine that fails or runs out of quota is skipped silently
    let chain: [Lang: [Engine]]
    // a cloud engine with no audio by then yields to the next one, while nothing is playing yet
    let firstAudioMs: Int
    // the pill's bars: how long each takes to glide most of the way to a new reading; 0 steps straight to it
    let meterGlideMs: Double
    // the pill's wave: how long each reading holds the centre before it moves one bar outward
    let meterFlowMs: Double
    let engines: [Engine: EngineConfig]

    subscript(engine: Engine) -> EngineConfig { engines[engine] ?? EngineConfig() }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        chain = try Self.keyed(container.decode([String: [String]].self, forKey: .chain), Lang.init) { names in
            try names.map { try Self.parse($0, Engine.init) }
        }
        firstAudioMs = try container.decode(Int.self, forKey: .firstAudioMs)
        meterGlideMs = try container.decodeIfPresent(Double.self, forKey: .meterGlideMs) ?? 30
        meterFlowMs = try container.decodeIfPresent(Double.self, forKey: .meterFlowMs) ?? 40
        engines = try Self.keyed(container.decode([String: EngineConfig].self, forKey: .engines), Engine.init) { $0 }
    }

    private init(chain: [Lang: [Engine]], firstAudioMs: Int, engines: [Engine: EngineConfig]) {
        self.chain = chain
        self.firstAudioMs = firstAudioMs
        meterGlideMs = 30
        meterFlowMs = 40
        self.engines = engines
    }

    // an unknown engine or language name fails the whole load, so a typo is reported instead of ignored
    private static func parse<T>(_ name: String, _ make: (String) -> T?) throws -> T {
        guard let value = make(name) else { throw ConfigError.unknownName(name) }
        return value
    }

    private static func keyed<K: Hashable, V, W>(_ raw: [String: V], _ make: (String) -> K?, _ map: (V) throws -> W) throws -> [K: W] {
        try Dictionary(uniqueKeysWithValues: raw.map { (try parse($0.key, make), try map($0.value)) })
    }

    // used only when config.json is unreadable at start
    static let fallback = Config(
        chain: [.en: [.kokoro, .system], .uk: [.system], .ru: [.system]],
        firstAudioMs: 500,
        engines: [.kokoro: EngineConfig(voice: ["en": "af_heart"], gain: 1.9)],
    )

    private enum CodingKeys: String, CodingKey { case chain, firstAudioMs, meterGlideMs, meterFlowMs, engines }
}

struct EngineConfig: Decodable {
    var model: String?
    // per language; for kokoro and gemini one voice serves every language they speak
    var voice: [String: String] = [:]
    // playback rate, pitch kept; 1 is the engine's own pace
    var speed: Double = 1
    var gain: Double = 1

    func voice(for lang: Lang) -> String? { voice[lang.rawValue] ?? voice["*"] }

    init(voice: [String: String] = [:], gain: Double = 1) {
        self.voice = voice
        self.gain = gain
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        voice = try container.decodeIfPresent([String: String].self, forKey: .voice) ?? [:]
        speed = try container.decodeIfPresent(Double.self, forKey: .speed) ?? 1
        gain = try container.decodeIfPresent(Double.self, forKey: .gain) ?? 1
        guard (0.5...3).contains(speed) else { throw ConfigError.outOfRange("speed", speed) }
        guard (0...4).contains(gain) else { throw ConfigError.outOfRange("gain", gain) }
    }

    private enum CodingKeys: String, CodingKey { case model, voice, speed, gain }
}

enum ConfigError: Error, CustomStringConvertible {
    case unknownName(String), outOfRange(String, Double)

    var description: String {
        switch self {
        case .unknownName(let name): "unknown name «\(name)» — engines: \(Engine.allCases.map(\.rawValue).joined(separator: ", ")); languages: en, uk, ru"
        case .outOfRange(let field, let value): "\(field) \(value) is out of range (speed 0.5–3, gain 0–4)"
        }
    }
}

@MainActor
final class ConfigFile {
    private let url: URL
    private var loadedStamp: Date?
    private var lastError: String?
    private(set) var current = Config.fallback

    init(_ url: URL) { self.url = url }

    private static func describe(_ error: Error) -> String {
        let path = { (context: DecodingError.Context) in context.codingPath.map(\.stringValue).joined(separator: ".") }
        return switch error {
        case DecodingError.dataCorrupted(let context):
            "not valid json — \((context.underlyingError as NSError?)?.userInfo[NSDebugDescriptionErrorKey] ?? context.debugDescription)"
        case DecodingError.keyNotFound(let key, let context): "missing «\((path(context).isEmpty ? "" : path(context) + ".") + key.stringValue)»"
        case DecodingError.typeMismatch(_, let context), DecodingError.valueNotFound(_, let context): "«\(path(context))» has the wrong type"
        default: "\(error)"
        }
    }

    // cheap enough for every press: one stat, and a parse only when the file changed. returns the reason the
    // file on disk is not the one in use, if it is not
    @discardableResult
    func refresh() -> String? {
        let stamp = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        guard stamp != loadedStamp else { return lastError }
        loadedStamp = stamp
        do {
            current = try JSONDecoder().decode(Config.self, from: Data(contentsOf: url))
            lastError = nil
            log("config: loaded \(url.lastPathComponent)")
        } catch {
            lastError = "\(url.lastPathComponent): \(Self.describe(error))"
            log("config: kept the last good one — \(lastError!)")
        }
        return lastError
    }
}
