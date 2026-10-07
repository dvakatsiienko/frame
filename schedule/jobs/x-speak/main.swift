// x-speak — F4 reads the selection aloud, cutting off what plays, and with none pauses / resumes; ⇧F4 pauses / resumes; F5 stops. one resident process so the hot path
// pays no boot, no key fetch and no player spawn (the node version paid ~1.2 s, measured 2026-09-29).
// usage: x-speak                        the daemon (launchd)
//        x-speak [--engine <name>] text one-shot, for listening tests
import AppKit
import AVFoundation
import Carbon.HIToolbox
import os

enum Engine: String, CaseIterable {
    case elevenlabs, fish, kokoro, system, gemini

    var isCloud: Bool { self != .kokoro && self != .system }
    var streams: Bool { self == .elevenlabs || self == .fish }
    func speaks(_ lang: Lang) -> Bool { self != .kokoro || lang == .en }
}

// chain, voices, speed, gain and the first-audio budget live in config.json, read again on the next F4 after a save
@MainActor let configFile = ConfigFile(URL(fileURLWithPath: NSHomeDirectory() + "/frame/schedule/jobs/x-speak/config.json"))
@MainActor var config: Config { configFile.current }

// :7385, clear of chords' worktree daemon on :7383
let kokoroURL = URL(string: "http://127.0.0.1:7385")!

// a voice named in config.json wins; otherwise the best installed uk/ru voice, so an enhanced download is picked up
// with no rebuild. en keeps the Spoken Content voice (siri voice 4), which no voice list exposes
@MainActor
func systemVoice(for lang: Lang, _ settings: EngineConfig) -> NSSpeechSynthesizer.VoiceName? {
    if let named = settings.voice(for: lang) { return NSSpeechSynthesizer.VoiceName(rawValue: named) }
    guard lang != .en else { return nil }
    return AVSpeechSynthesisVoice.speechVoices()
        .filter { $0.language.hasPrefix(lang.rawValue) }
        .max { $0.quality.rawValue < $1.quality.rawValue }
        .map { NSSpeechSynthesizer.VoiceName(rawValue: $0.identifier) }
}

struct Chunk {
    let lang: Lang
    let text: String
}

enum EngineError: Error {
    case noKey, noVoice, status(Int), timeout
    // the provider's own words, e.g. «you have 14 credits remaining, while 203 are required»
    case quota(String)
}

// a non-200 reply: a quota answer (elevenlabs says `quota_exceeded` in its json) is told apart from a plain status
func failure(_ status: Int, _ bytes: URLSession.AsyncBytes) async -> EngineError {
    var body = Data()
    do { for try await byte in bytes { body.append(byte); if body.count > 4096 { break } } } catch {}
    let detail = (try? JSONSerialization.jsonObject(with: body) as? [String: Any])?["detail"] as? [String: Any]
    guard detail?["status"] as? String == "quota_exceeded" || detail?["code"] as? String == "quota_exceeded" else { return .status(status) }
    return .quota(detail?["message"] as? String ?? "out of quota")
}

func log(_ line: String) {
    let stamp = ISO8601DateFormatter.string(from: Date(), timeZone: .current, formatOptions: [.withFullDate, .withDashSeparatorInDate, .withSpaceBetweenDateAndTime, .withTime, .withColonSeparatorInTime, .withFractionalSeconds])
    FileHandle.standardError.write(Data("\(stamp) \(line)\n".utf8))
}

func elapsed(_ since: ContinuousClock.Instant) -> String {
    let ms = (ContinuousClock.now - since).components
    return "\(ms.seconds * 1000 + ms.attoseconds / 1_000_000_000_000_000) ms"
}

// sentences, and a long first sentence cut at its first comma past 40 chars, so audio starts early
func chunks(_ runs: [Run]) -> [Chunk] {
    var result: [Chunk] = []
    for run in runs {
        let marked = run.text.replacingOccurrences(of: "([.!?…;])\\s+", with: "$1\0", options: .regularExpression)
        for sentence in marked.split(separator: "\0") {
            var text = String(sentence)
            if result.isEmpty, text.count > 100, let comma = text.dropFirst(40).firstIndex(of: ",") {
                result.append(Chunk(lang: run.lang, text: String(text[...comma])))
                text = String(text[text.index(after: comma)...]).trimmingCharacters(in: .whitespaces)
            }
            result.append(Chunk(lang: run.lang, text: text))
        }
    }
    return result
}

@MainActor
final class Player {
    private let engine = AVAudioEngine()
    private let node = AVAudioPlayerNode()
    // speed without a pitch shift, applied on playback so no engine re-renders for it
    private let pace = AVAudioUnitTimePitch()
    private let format = AVAudioFormat(standardFormatWithSampleRate: 24000, channels: 1)!
    private var pending = 0
    private var drainWaiters: [CheckedContinuation<Void, Never>] = []
    private var generation = 0
    // every buffer ever scheduled: a stop's delayed pause holds off once anything new was scheduled after it
    private var scheduled = 0
    // when the queue ran dry mid-read: the next buffer logs the silence the listener heard
    private var dryAt: ContinuousClock.Instant?

    var isPlaying: Bool { pending > 0 }
    // the panel's meter: the mixer's levels, one per 10 ms of a rendered buffer, and the spacing between them
    var onLevels: (([Float], TimeInterval) -> Void)?

    init() {
        engine.attach(node)
        engine.attach(pace)
        engine.connect(node, to: pace, format: format)
        engine.connect(pace, to: engine.mainMixerNode, format: format)
        // coreaudio hands the tap 100 ms buffers whatever size is asked (4800 frames at 48 kHz, measured with 512 and
        // 1024), so one reading per buffer fed the meter 10 times a second. each buffer is cut into 10 ms windows
        // instead, and the meter plays them out over the buffer's span: ~100 readings a second
        engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { [weak self] buffer, _ in
            guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return }
            let frames = Int(buffer.frameLength)
            let window = max(1, Int(buffer.format.sampleRate / 100))
            let levels = stride(from: 0, to: frames, by: window).map { start in
                let end = min(frames, start + window)
                var sum: Float = 0
                for i in start..<end { sum += samples[i] * samples[i] }
                let decibels = 10 * log10(max(sum / Float(end - start), 1e-9))
                return min(1, max(0, (decibels + 50) / 50))
            }
            let spacing = Double(window) / buffer.format.sampleRate
            Task { @MainActor in self?.onLevels?(levels, spacing) }
        }
        // an engine left on a gone output device makes every play() wait out a 5 s IO timeout on main (AirPods,
        // 2026-10-07): a device switch stops it, and the next schedule starts it on the current default device
        NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.release("engine configuration changed") }
        }
        var defaultOutput = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultOutputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &defaultOutput, .main) { [weak self] _, _ in
            MainActor.assumeIsolated { self?.release("default output device changed") }
        }
    }

    private func release(_ why: String) {
        log("audio: \(why), engine released")
        stop()
        engine.stop()
    }

    // s16le mono 24 kHz → float, with the engine's gain and speed
    func schedule(_ pcm: Data, _ settings: EngineConfig) throws {
        let gain = Float(settings.gain)
        pace.rate = Float(settings.speed)
        // at 1× the speed stage is skipped, so its buffering adds nothing to pause, resume or the first sample
        pace.bypass = settings.speed == 1
        let frames = pcm.count / 2
        guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)) else { return }
        buffer.frameLength = AVAudioFrameCount(frames)
        let out = buffer.floatChannelData![0]
        pcm.withUnsafeBytes { raw in
            let samples = raw.bindMemory(to: Int16.self)
            for i in 0..<frames { out[i] = max(-1, min(1, Float(Int16(littleEndian: samples[i])) / 32768 * gain)) }
        }
        if !engine.isRunning { try engine.start() }
        if !node.isPlaying { node.play() }
        if pending == 0, let dryAt { log("silence: \(elapsed(dryAt)) mid-read") }
        dryAt = nil
        pending += 1
        scheduled += 1
        let scheduledIn = generation
        node.scheduleBuffer(buffer) { [weak self] in
            Task { @MainActor in
                guard let self, self.generation == scheduledIn else { return }
                self.pending -= 1
                if self.pending == 0 {
                    self.dryAt = .now
                    self.releaseWaiters()
                }
            }
        }
    }

    func pause() { node.pause() }
    func resume() { node.play() }

    func drained() async {
        if pending == 0 { return }
        await withCheckedContinuation { drainWaiters.append($0) }
    }

    // the engine pauses 2 s later, unless a new read scheduled audio meanwhile: one left running feeds the meter's tap
    // silence, and hours of it once froze the pill; one paused at once restarted under the next read and stumbled the
    // F4-over-F4 hand-off. a new read's own idle() pauses it once that read ends
    func stop() {
        generation += 1
        node.stop()
        pending = 0
        dryAt = nil
        releaseWaiters()
        let stoppedAt = scheduled
        Task {
            try? await Task.sleep(for: .seconds(2))
            if scheduled == stoppedAt { engine.pause() }
        }
    }

    // an idle engine still holds the output device; let it go between jobs
    func idle() {
        dryAt = nil
        if pending == 0 { engine.pause() }
    }

    private func releaseWaiters() {
        drainWaiters.forEach { $0.resume() }
        drainWaiters = []
    }
}

// one synth at a time, and only its own callbacks count: a stopped synth's late «finished» once resumed the next
// read's wait, that read moved on while its synth still talked, and F5 could no longer reach the orphan
@MainActor
final class SystemVoice: NSObject, NSSpeechSynthesizerDelegate {
    private var synth: NSSpeechSynthesizer?
    private var done: CheckedContinuation<Void, Never>?
    private var onFirstWord: (() -> Void)?

    var isBusy: Bool { onFirstWord != nil }

    func speak(_ chunk: Chunk, _ settings: EngineConfig, onFirstWord: @escaping () -> Void) async {
        stop()
        let synth = systemVoice(for: chunk.lang, settings).flatMap { NSSpeechSynthesizer(voice: $0) } ?? NSSpeechSynthesizer()
        synth.delegate = self
        synth.rate *= Float(settings.speed)
        self.synth = synth
        self.onFirstWord = onFirstWord
        await withCheckedContinuation { continuation in
            done = continuation
            // a synth that refuses to start never calls back, so the read would wait on it until the next press
            if !synth.startSpeaking(chunk.text) { stop() }
        }
    }

    func stop() {
        synth?.delegate = nil
        synth?.stopSpeaking()
        synth = nil
        onFirstWord = nil
        done?.resume()
        done = nil
    }

    func pause() { synth?.pauseSpeaking(at: .immediateBoundary) }
    func resume() { synth?.continueSpeaking() }

    nonisolated func speechSynthesizer(_ sender: NSSpeechSynthesizer, willSpeakWord range: NSRange, of string: String) {
        guard range.location == 0 else { return }
        MainActor.assumeIsolated {
            guard sender === synth else { return }
            onFirstWord?()
            onFirstWord = nil
        }
    }

    nonisolated func speechSynthesizer(_ sender: NSSpeechSynthesizer, didFinishSpeaking finishedSpeaking: Bool) {
        MainActor.assumeIsolated {
            guard sender === synth else { return }
            synth = nil
            done?.resume()
            done = nil
        }
    }
}

@MainActor
final class Speaker {
    private let player = Player()
    private let systemVoice = SystemVoice()
    let panel = Panel()
    private var keys: [Engine: String] = [:]
    private var keysLoadedAt: Date?
    // engine → when it may be tried again; a failure costs its time once, then nothing until the reset
    private var skipUntil: [Engine: Date] = [:]
    // engine → the provider's quota message; cleared by the engine's next success, so a monthly reset heals itself
    private var outOfQuota: [Engine: String] = [:]
    private var quotaProbedAt: Date?
    private var job: Task<Void, Never>?
    // numbers each read in the log, so two reads talking at once show as two numbers interleaved
    private var reads = 0
    private var kokoroPrefetch: (text: String, task: Task<Data, Error>)?
    // the next chunk's request, opened once this one is heard: its first-audio wait (0.5–3 s on fish's free tier)
    // hides behind the audio instead of sitting between two sentences
    private var cloudPrefetch: (engine: Engine, text: String, task: Task<(URLSession.AsyncBytes, URLResponse), Error>)?
    // a preview's unsaved card settings, in force for that one job
    private var draft: (engine: Engine, settings: EngineConfig)?

    private func settings(_ engine: Engine) -> EngineConfig {
        draft.flatMap { $0.engine == engine ? $0.settings : nil } ?? config[engine]
    }

    // the admin asks every few seconds: a status older than 10 min refreshes the quota behind this answer
    func health() -> [String: [String: String]] {
        if quotaProbedAt.map({ Date().timeIntervalSince($0) > 600 }) ?? true { Task { await probeQuota() } }
        var result: [String: [String: String]] = [:]
        for engine in Engine.allCases {
            let needsKey = engine.isCloud && keys[engine] == nil
            let until = skipUntil[engine].flatMap { $0 > Date() ? $0 : nil }
            result[engine.rawValue] = needsKey ? ["state": "no key"]
                : outOfQuota[engine].map { ["state": "no quota", "note": $0] }
                ?? until.map { ["state": "benched", "until": ISO8601DateFormatter().string(from: $0)] } ?? ["state": "live"]
        }
        return result
    }

    init() {
        player.onLevels = { [panel] levels, spacing in panel.model.push(levels, spacing: spacing) }
        panel.model.onClose = { [panel] in panel.hide() }
        panel.model.onPause = { [weak self] in self?.togglePause() }
        panel.model.onStop = { [weak self] in
            self?.stop()
            self?.panel.speechEnded()
        }
        panel.model.onUnstick = { [weak self] in
            if self?.isSpeaking == false { self?.panel.hide() }
        }
    }

    func togglePause() {
        guard isSpeaking else { return }
        panel.model.isPaused.toggle()
        if panel.model.isPaused {
            player.pause()
            systemVoice.pause()
        } else {
            player.resume()
            systemVoice.resume()
        }
    }

    func stop() {
        if job != nil { log("read \(reads): stopped") }
        job?.cancel()
        cloudPrefetch?.task.cancel()
        cloudPrefetch = nil
        kokoroPrefetch?.task.cancel()
        kokoroPrefetch = nil
        player.stop()
        systemVoice.stop()
        job = nil
        draft = nil
    }

    // a preview ignores the bench: dima asked to hear this engine, so it is tried even when benched
    func preview(_ text: String, with engine: Engine, settings: EngineConfig) {
        stop()
        draft = (engine, settings)
        skipUntil[engine] = nil
        speak(chunks(normalize(text)), only: engine, pressed: .now)
    }

    var isSpeaking: Bool { job != nil }

    // one op-run per daemon start (~0.8 s), never on the hot path; a key pasted later is picked up within a minute
    func loadKeys() async {
        keysLoadedAt = Date()
        let names: [(Engine, String)] = [(.elevenlabs, "ELEVENLABS_API_KEY"), (.fish, "FISH_API_KEY"), (.gemini, "GEMINI_API_KEY")]
        let printf = "printf '%s\\0%s\\0%s' " + names.map { "\"$\($0.1)\"" }.joined(separator: " ")
        let output: String = await Task.detached {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/sh")
            process.arguments = [NSHomeDirectory() + "/frame/script/op-run.sh", "/bin/sh", "-c", printf]
            // op run masks secrets in its child's stdout; the keys go straight into this process, never a log
            process.environment = ProcessInfo.processInfo.environment.merging(["OP_RUN_NO_MASKING": "true"]) { $1 }
            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = FileHandle.nullDevice
            try? process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            return String(decoding: data, as: UTF8.self)
        }.value
        for (value, (engine, _)) in zip(output.split(separator: "\0", omittingEmptySubsequences: false), names) where !value.isEmpty {
            keys[engine] = String(value)
        }
        log("keys: " + names.map { "\($0.0.rawValue) \(keys[$0.0] == nil ? "missing" : "ok")" }.joined(separator: ", "))
    }

    private var kokoroServer: Process?
    private var isWarmingKokoro = false

    // one warm-up at a time; a finished one lifts kokoro's bench so the next press can use it
    // the providers' balance calls cost nothing: a card shows the real quota before a press finds it, and an empty
    // engine sits benched until its refill instead of spending ~1 s of every press on a refusal
    func probeQuota() async {
        quotaProbedAt = Date()
        async let eleven = elevenlabsQuota()
        async let fish = fishQuota()
        for (engine, quota) in [(Engine.elevenlabs, await eleven), (.fish, await fish)] {
            switch quota {
            case .empty(let message, let until)?:
                outOfQuota[engine] = message
                skipUntil[engine] = until
            case .left? where outOfQuota[engine] != nil:
                outOfQuota[engine] = nil
                skipUntil[engine] = nil
            default: break
            }
        }
    }

    // needs the key's «User» permission (user_read); a key without it answers 401 and the card keeps its last state
    private func elevenlabsQuota() async -> Quota? {
        guard let key = keys[.elevenlabs] else { return nil }
        var request = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/user/subscription")!)
        request.setValue(key, forHTTPHeaderField: "xi-api-key")
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let used = json["character_count"] as? Int, let limit = json["character_limit"] as? Int,
              let reset = json["next_character_count_reset_unix"] as? Double else { return nil }
        // a sentence costs 30–200 credits, so under 100 left a press fails more often than it plays
        guard limit - used < 100 else { return .left }
        let refill = Date(timeIntervalSince1970: reset)
        return .empty("\(limit - used) of \(limit) credits left, refills \(refill.formatted(.dateTime.month(.abbreviated).day()))", until: refill)
    }

    // the free model draws on no balance; a paid one spends the pay-as-you-go api credit, which has no refill date
    private func fishQuota() async -> Quota? {
        guard (settings(.fish).model ?? "s2.1-pro-free").hasSuffix("-free") == false else { return .left }
        guard let key = keys[.fish] else { return nil }
        var request = URLRequest(url: URL(string: "https://api.fish.audio/wallet/self/api-credit")!)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let credit = (json["credit"] as? String).flatMap(Double.init) else { return nil }
        return credit > 0 ? .left : .empty("api balance $0 — top up at fish.audio", until: Date().addingTimeInterval(3600))
    }

    func warmKokoro() async {
        guard !isWarmingKokoro else { return }
        isWarmingKokoro = true
        defer { isWarmingKokoro = false }
        if await kokoroReady() { return }
        let server = Process()
        server.executableURL = URL(fileURLWithPath: NSHomeDirectory() + "/.local/bin/mlx_audio.server")
        server.arguments = ["--host", "127.0.0.1", "--port", String(kokoroURL.port ?? 7385)]
        // launchd starts us in /, read-only, and the server makes a logs/ dir in its working directory
        server.currentDirectoryURL = URL(fileURLWithPath: NSHomeDirectory() + "/.local/share/x-speak")
        // its own log, beside the daemon's: a server that dies at start says why here
        let logPath = NSHomeDirectory() + "/.local/share/x-speak/kokoro.log"
        FileManager.default.createFile(atPath: logPath, contents: nil)
        let logFile = FileHandle(forWritingAtPath: logPath)
        server.standardOutput = logFile ?? FileHandle.nullDevice
        server.standardError = logFile ?? FileHandle.nullDevice
        server.terminationHandler = { process in log("kokoro: server exited, status \(process.terminationStatus)") }
        do {
            try server.run()
        } catch {
            log("kokoro: server did not start — \(error)")
            return
        }
        kokoroServer = server
        for _ in 0..<240 where !(await kokoroReady()) { try? await Task.sleep(for: .milliseconds(250)) }
        guard await kokoroReady() else {
            log("kokoro: server not answering after 60 s")
            return
        }
        _ = try? await URLSession.shared.data(for: kokoroRequest("Ready.", voice: config[.kokoro].voice(for: .en)))
        skipUntil[.kokoro] = nil
        log("kokoro: warm")
    }

    // F5: stop, and the pill leaves unless stick holds it
    // ⇧F4: pause / resume what plays, whatever is selected
    func pausePressed() {
        log("press: ⇧F4 → \(isSpeaking ? (panel.model.isPaused ? "resume" : "pause") : "nothing playing")")
        togglePause()
    }

    // unconditional: F5 silences every voice, even one no read owns any more
    func stopPressed() {
        stop()
        panel.speechEnded()
    }

    // F4 reads the selection, cutting off what plays; with nothing selected it pauses / resumes what plays. ⇧F4 is
    // pause's second door, selection or not (dima, 2026-09-30). F5 stops
    func readPressed() async {
        let pressed = ContinuousClock.now
        configFile.refresh()
        // read live: a grant given while the daemon runs applies on the next press, no restart
        guard AXIsProcessTrusted() else {
            log("press: accessibility missing — grant bin/x-speak in Privacy & Security")
            return
        }
        var (text, via) = await grabSelection()
        // an empty accessibility answer is trusted only while something plays (F4 = pause, no 300 ms ⌘C wait);
        // idle, F4 means «read», so ⌘C gets a try: a selection inside a canvas or a frame is not the focused
        // element's (Chrome on a claude.ai artifact, 2026-10-01)
        if (text ?? "").isEmpty, via == "ax", !isSpeaking {
            text = await copySelection()
            via = "ax → ⌘C"
        }
        let grabbed = elapsed(pressed)
        let parts = chunks(normalize(text ?? ""))
        guard !parts.isEmpty else {
            log("press: nothing selected (grab \(via) \(grabbed))\(isSpeaking ? " → pause / resume" : "")")
            togglePause()
            return
        }
        log("press: grab \(via) \(grabbed), normalize \(elapsed(pressed)), \(parts.count) chunks")
        if job != nil { stop() }
        speak(parts, only: nil, pressed: pressed)
        if keys.count < 3, let loaded = keysLoadedAt, Date().timeIntervalSince(loaded) > 60 {
            Task { await loadKeys() }
        }
    }

    // `only` is --engine: one engine, no chain
    func speak(_ parts: [Chunk], only: Engine?, pressed: ContinuousClock.Instant) {
        // real speech ends the admin's infinite waveform: the meter goes back to the sound
        panel.stopWave()
        panel.show()
        reads += 1
        let read = reads
        job = Task {
            var isFirst = true
            // the engine that played the read's first chunk leads every later one, so one read keeps one voice: a
            // cloud engine that missed chunk 1's budget no longer takes over mid-read once audio is playing
            var lead: Engine?
            for (index, chunk) in parts.enumerated() {
                // the mac voice and kokoro finish a chunk normally even after a stop, so a stopped read ends here
                if Task.isCancelled { return }
                log("read \(read): chunk \(index + 1)/\(parts.count)")
                var candidates = (only.map { [$0] } ?? config.chain[chunk.lang] ?? []).filter { $0.speaks(chunk.lang) && (skipUntil[$0] ?? .distantPast) < Date() }
                if let lead, let at = candidates.firstIndex(of: lead) { candidates.insert(candidates.remove(at: at), at: 0) }
                // a cloud engine racing its deadline: kokoro renders the same chunk meanwhile, so a miss costs nothing
                if lead == nil, candidates.first?.isCloud == true, candidates.contains(.kokoro), !player.isPlaying {
                    let voice = settings(.kokoro).voice(for: .en)
                    kokoroPrefetch = (chunk.text, Task { try await kokoroPCM(chunk.text, voice: voice) })
                }
                // one first-audio budget per chunk, shared by every cloud engine: misses never stack
                let budgetEnds = player.isPlaying || systemVoice.isBusy ? nil : ContinuousClock.now + .milliseconds(config.firstAudioMs)
                for engine in candidates {
                    // the last candidate has nothing to yield to, so it waits as long as it takes; neither does the read's
                    // lead — a gap between chunks must not hand its voice to the next engine
                    let deadline = engine.isCloud && engine != candidates.last && engine != lead ? budgetEnds.map { $0 - ContinuousClock.now } : nil
                    if let deadline, deadline <= .zero { continue }
                    do {
                        try await speak(chunk, with: engine, deadline: deadline) {
                            if isFirst { log("first audio: \(engine.rawValue) \(elapsed(pressed))") }
                            isFirst = false
                            if engine.streams, parts.indices.contains(index + 1) { self.openAhead(parts[index + 1], with: engine) }
                        }
                        outOfQuota[engine] = nil
                        if let lead, lead != engine { log("voice switch: \(lead.rawValue) → \(engine.rawValue) mid-read") }
                        lead = engine
                        break
                    } catch is CancellationError {
                        return
                    } catch {
                        if Task.isCancelled { return }
                        handle(error, from: engine)
                    }
                }
            }
            await player.drained()
            if !Task.isCancelled {
                job = nil
                draft = nil
                player.idle()
                panel.speechEnded()
            }
        }
    }

    // quota or auth → an hour off; 5xx or offline → a minute off. a slow start and a missing key cost only this
    // press: benching on a slow start turned one miss into a minute of kokoro (dima, 2026-09-29)
    private func handle(_ error: Error, from engine: Engine) {
        let pause: TimeInterval? = switch error {
        case EngineError.noKey, EngineError.noVoice, EngineError.timeout: nil
        case EngineError.status(let code) where [401, 402, 403, 429].contains(code): 3600
        case EngineError.quota: 3600
        default: 60
        }
        if let pause { skipUntil[engine] = Date().addingTimeInterval(pause) }
        if case EngineError.quota(let message) = error {
            outOfQuota[engine] = message
            // the refusal knows no refill date; the probe does, and benches the engine until then instead of for an hour
            Task { await probeQuota() }
        }
        // the kokoro server is ours to keep alive: one that stops answering is started again, off the hot path
        if engine == .kokoro, (error as? URLError)?.code == .cannotConnectToHost {
            Task { await warmKokoro() }
        }
        log("\(engine.rawValue) skipped: \(error)\(pause.map { ", off for \(Int($0)) s" } ?? "")")
    }

    private func speak(_ chunk: Chunk, with engine: Engine, deadline: Duration?, onAudio: @escaping () -> Void) async throws {
        switch engine {
        case .system:
            await player.drained()
            try Task.checkCancellation()
            await systemVoice.speak(chunk, settings(.system), onFirstWord: onAudio)
        case .gemini:
            try await playGemini(chunk, onAudio: onAudio)
        // the kokoro server answers only once the whole chunk is rendered, so there is nothing to stream
        case .kokoro:
            let prefetched = kokoroPrefetch.flatMap { $0.text == chunk.text ? $0.task : nil }
            kokoroPrefetch = nil
            let pcm = if let prefetched { try await prefetched.value } else { try await kokoroPCM(chunk.text, voice: settings(.kokoro).voice(for: .en)) }
            // a render that lands after a stop never reaches the player
            try Task.checkCancellation()
            try player.schedule(pcm, settings(.kokoro))
            onAudio()
        default:
            let ahead = cloudPrefetch.flatMap { $0.engine == engine && $0.text == chunk.text ? $0.task : nil }
            if ahead == nil { cloudPrefetch?.task.cancel() }
            cloudPrefetch = nil
            let request = try request(for: engine, chunk)
            let open = ahead ?? Task { try await URLSession.shared.bytes(for: request) }
            try await stream(open, settings(engine), deadline: deadline, onAudio: onAudio)
        }
    }

    private func openAhead(_ chunk: Chunk, with engine: Engine) {
        guard let request = try? request(for: engine, chunk) else { return }
        cloudPrefetch?.task.cancel()
        cloudPrefetch = (engine, chunk.text, Task { try await URLSession.shared.bytes(for: request) })
    }

    private func request(for engine: Engine, _ chunk: Chunk) throws -> URLRequest {
        switch engine {
        case .elevenlabs:
            guard let key = keys[.elevenlabs] else { throw EngineError.noKey }
            // a premade voice: library voices answer 402 on free and restricted keys
            guard let voice = settings(.elevenlabs).voice(for: chunk.lang) else { throw EngineError.noVoice }
            var request = URLRequest(url: URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voice)/stream?output_format=pcm_24000")!)
            request.httpMethod = "POST"
            request.setValue(key, forHTTPHeaderField: "xi-api-key")
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["language_code": chunk.lang.rawValue, "model_id": settings(.elevenlabs).model ?? "eleven_v4_turbo", "text": chunk.text])
            return request
        case .fish:
            guard let key = keys[.fish] else { throw EngineError.noKey }
            guard let voice = settings(.fish).voice(for: chunk.lang) else { throw EngineError.noVoice }
            // s2.1-pro-free: no character cap, free until 2026-11-30; after that its non-2xx drops the tier by itself
            var request = URLRequest(url: URL(string: "https://api.fish.audio/v1/tts")!)
            request.httpMethod = "POST"
            request.setValue("Bearer \(key)", forHTTPHeaderField: "authorization")
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            request.setValue(settings(.fish).model ?? "s2.1-pro-free", forHTTPHeaderField: "model")
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "format": "pcm", "latency": "balanced", "reference_id": voice, "sample_rate": 24000, "text": chunk.text,
            ])
            return request
        default:
            preconditionFailure("\(engine) is not a streaming engine")
        }
    }

    // plays as bytes arrive; with a deadline, no audio by then throws before anything was heard
    // the byte loop runs off the main actor: on it, a buffered response starved the deadline timer (fish
    // played at 604 ms under a 400 ms deadline). `state` settles the race — audio or timeout, never both.
    private func stream(_ open: Task<(URLSession.AsyncBytes, URLResponse), Error>, _ settings: EngineConfig, deadline: Duration?, onAudio: @escaping () -> Void) async throws {
        let state = OSAllocatedUnfairLock(initialState: StreamState.waiting)
        let player = self.player
        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                let (bytes, response) = try await withTaskCancellationHandler { try await open.value } onCancel: { open.cancel() }
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                guard status == 200 else { throw await failure(status, bytes) }
                var buffer = Data()
                // 20 ms for the first buffer so audio starts at once, then 100 ms to schedule cheaply
                var threshold = 960
                func flush() async throws {
                    let pcm = buffer.prefix(buffer.count & ~1)
                    buffer.removeFirst(pcm.count)
                    let isFirst = state.withLock { current in
                        guard current != .timedOut else { return false }
                        defer { current = .playing }
                        return current == .waiting
                    }
                    guard state.withLock({ $0 == .playing }) else { throw CancellationError() }
                    // checked on main, where stop() runs: bytes that land after a stop never reach the player
                    try await MainActor.run {
                        try Task.checkCancellation()
                        try player.schedule(Data(pcm), settings)
                        if isFirst { onAudio() }
                    }
                }
                for try await byte in bytes {
                    buffer.append(byte)
                    if buffer.count >= threshold {
                        try await flush()
                        threshold = 4800
                    }
                }
                if buffer.count > 1 { try await flush() }
            }
            if let deadline {
                group.addTask {
                    try await Task.sleep(for: deadline)
                    let isLate = state.withLock { current in
                        guard current == .waiting else { return false }
                        current = .timedOut
                        return true
                    }
                    if isLate { throw EngineError.timeout }
                }
            }
            try await group.waitForAll()
        }
    }

    private func playGemini(_ chunk: Chunk, onAudio: () -> Void) async throws {
        guard let key = keys[.gemini] else { throw EngineError.noKey }
        let settings = settings(.gemini)
        let model = settings.model ?? "gemini-3.8-flash-tts"
        var request = URLRequest(url: URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent")!)
        request.httpMethod = "POST"
        request.setValue(key, forHTTPHeaderField: "x-goog-api-key")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "contents": [["parts": [["text": chunk.text]]]],
            "generationConfig": ["responseModalities": ["AUDIO"], "speechConfig": ["voiceConfig": ["prebuiltVoiceConfig": ["voiceName": settings.voice(for: chunk.lang) ?? "Kore"]]]],
        ])
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw EngineError.status(status) }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let parts = ((json?["candidates"] as? [[String: Any]])?.first?["content"] as? [String: Any])?["parts"] as? [[String: Any]]
        guard let base64 = (parts?.first?["inlineData"] as? [String: Any])?["data"] as? String, var audio = Data(base64Encoded: base64) else {
            throw EngineError.status(0)
        }
        if audio.prefix(4) == Data("RIFF".utf8) { audio = audio.dropFirst(44) }
        try Task.checkCancellation()
        try player.schedule(Data(audio), settings)
        onAudio()
    }
}

func kokoroRequest(_ text: String, voice: String?) -> URLRequest {
    var request = URLRequest(url: kokoroURL.appending(path: "v1/audio/speech"))
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "content-type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
        "input": text, "model": "mlx-community/Kokoro-82M-bf16", "response_format": "pcm", "voice": voice ?? "af_heart",
    ])
    return request
}

func kokoroReady() async -> Bool {
    var request = URLRequest(url: kokoroURL.appending(path: "docs"))
    request.timeoutInterval = 1
    return ((try? await URLSession.shared.data(for: request))?.1 as? HTTPURLResponse)?.statusCode == 200
}

// the focused element's selected text through accessibility; ⌘C only where an app exposes none. an empty answer
// from accessibility is trusted as «nothing selected»: the ⌘C fallback waits ~300 ms for a copy that never comes,
// and that wait was the delay on every pause / resume (dima, 2026-09-29)
// apps whose accessibility focus is a different element from the selection: Slack reports its message box, empty,
// while the selected text sits in the message list (36 «nothing selected» presses, 2026-10-01)
let copyOnlyApps: Set<String> = ["com.tinyspeck.slackmacgap"]

@MainActor
func grabSelection() async -> (String?, String) {
    if let id = NSWorkspace.shared.frontmostApplication?.bundleIdentifier, copyOnlyApps.contains(id) {
        return (await copySelection(), "⌘C")
    }
    // electron and chromium build their accessibility tree only when asked; the flag is per app and idempotent
    if let pid = NSWorkspace.shared.frontmostApplication?.processIdentifier {
        AXUIElementSetAttributeValue(AXUIElementCreateApplication(pid), "AXManualAccessibility" as CFString, kCFBooleanTrue)
    }
    // the app's own focused element first: electron's system-wide focus query fails (-25204) where the app's answers
    var focused: CFTypeRef?
    let front = NSWorkspace.shared.frontmostApplication.map { AXUIElementCreateApplication($0.processIdentifier) }
    if !(front.map { AXUIElementCopyAttributeValue($0, kAXFocusedUIElementAttribute as CFString, &focused) == .success } ?? false) {
        _ = AXUIElementCopyAttributeValue(AXUIElementCreateSystemWide(), kAXFocusedUIElementAttribute as CFString, &focused)
    }
    if let element = focused, CFGetTypeID(element) == AXUIElementGetTypeID() {
        var selected: CFTypeRef?
        switch AXUIElementCopyAttributeValue(element as! AXUIElement, kAXSelectedTextAttribute as CFString, &selected) {
        case .success: return ((selected as? String).flatMap { $0.isEmpty ? nil : $0 }, "ax")
        // the element keeps selected text and has none right now: nothing is selected, no ⌘C wait
        case .noValue: return (nil, "ax")
        default: break
        }
    }
    return (await copySelection(), "⌘C")
}

// the clipboard comes back whole, every type of every item, once the copy has been read
@MainActor
func copySelection() async -> String? {
    let board = NSPasteboard.general
    let saved = board.pasteboardItems?.map { item in item.types.compactMap { type in item.data(forType: type).map { (type, $0) } } } ?? []
    let before = board.changeCount
    let source = CGEventSource(stateID: .combinedSessionState)
    for isDown in [true, false] {
        let event = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(kVK_ANSI_C), keyDown: isDown)
        event?.flags = .maskCommand
        event?.post(tap: .cghidEventTap)
    }
    for _ in 0..<60 where board.changeCount == before { try? await Task.sleep(for: .milliseconds(5)) }
    guard board.changeCount != before else { return nil }
    let text = board.string(forType: .string)
    board.clearContents()
    board.writeObjects(saved.map { pairs in
        let item = NSPasteboardItem()
        for (type, data) in pairs { item.setData(data, forType: type) }
        return item
    })
    return text
}

@MainActor let speaker = Speaker()

// main stays synchronous: NSApplication.run() inside an async main blocked the main actor for good, so no
// hotkey handler and no control reply ever ran (dima's first F4, 2026-09-29)
@main
struct XSpeak {
    @MainActor
    static func main() {
        var args = Array(CommandLine.arguments.dropFirst())
        var only: Engine?
        if let flag = args.firstIndex(of: "--engine"), flag + 1 < args.count, let engine = Engine(rawValue: args[flag + 1]) {
            only = engine
            args.removeSubrange(flag...(flag + 1))
        }
        configFile.refresh()

        if !args.isEmpty {
            Task {
                await speaker.loadKeys()
                if only == nil || only == .kokoro { await speaker.warmKokoro() }
                speaker.speak(chunks(normalize(args.joined(separator: " "))), only: only, pressed: .now)
                while speaker.isSpeaking { try? await Task.sleep(for: .milliseconds(50)) }
                exit(0)
            }
            // the app loop, like the daemon: the pill is a window, and under dispatchMain its first show landed off the
            // main thread and crashed every one-shot run
            NSApplication.shared.setActivationPolicy(.prohibited)
            NSApplication.shared.run()
        }

        Task {
            await speaker.loadKeys()
            await speaker.probeQuota()
            await speaker.warmKokoro()
        }
        let control = Control()
        control.start()
        heartbeat.start()
        var hotKey: EventHotKeyRef?
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        // one handler for every key; the hotkey id says which fired: 1 is F4, 2 is F5, 3 is ⇧F4
        InstallEventHandler(GetEventDispatcherTarget(), { _, event, _ in
            var fired = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &fired)
            let id = fired.id
            log("hotkey: \(id == 2 ? "F5" : id == 3 ? "⇧F4" : "F4")")
            Task { @MainActor in
                switch id {
                case 2: speaker.stopPressed()
                case 3: speaker.pausePressed()
                default: await speaker.readPressed()
                }
            }
            return noErr
        }, 1, &spec, nil, nil)
        var stopKey: EventHotKeyRef?
        var pauseKey: EventHotKeyRef?
        let status = RegisterEventHotKey(UInt32(kVK_F4), 0, EventHotKeyID(signature: 0x5350_4B31, id: 1), GetEventDispatcherTarget(), 0, &hotKey)
        let stopStatus = RegisterEventHotKey(UInt32(kVK_F5), 0, EventHotKeyID(signature: 0x5350_4B31, id: 2), GetEventDispatcherTarget(), 0, &stopKey)
        let pauseStatus = RegisterEventHotKey(UInt32(kVK_F4), UInt32(shiftKey), EventHotKeyID(signature: 0x5350_4B31, id: 3), GetEventDispatcherTarget(), 0, &pauseKey)
        // with the prompt option macos itself asks for the grant, naming this exact process — no guessing which entry
        let isTrusted = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary)
        log("daemon: F4 \(status == noErr ? "registered" : "refused (\(status))"), F5 \(stopStatus == noErr ? "registered" : "refused (\(stopStatus))"), ⇧F4 \(pauseStatus == noErr ? "registered" : "refused (\(pauseStatus))"), accessibility \(isTrusted ? "granted" : "missing — macos shows its grant prompt")")
        NSApplication.shared.setActivationPolicy(.prohibited)
        NSApplication.shared.run()
    }
}

enum StreamState { case waiting, playing, timedOut }

enum Quota { case left, empty(String, until: Date) }

func kokoroPCM(_ text: String, voice: String?) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: kokoroRequest(text, voice: voice))
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard status == 200 else { throw EngineError.status(status) }
    return data
}
