// the admin page's door into the running daemon: one json line in, one json line out, over a unix socket
// only this user can open. previews go through the daemon's own speak path, never a second synth.
// the socket lives on its own queue: a main thread stuck for minutes once took the admin down with it
import ApplicationServices
import AVFoundation
import Foundation
import Network
import os

let controlSocket = NSHomeDirectory() + "/.local/share/x-speak/control.sock"

// main stamps it twice a second; the socket and the watchdog read how long main has gone without a turn
final class Heartbeat: @unchecked Sendable {
    private let last = OSAllocatedUnfairLock(initialState: ContinuousClock.now)

    var age: Duration { .now - last.withLock { $0 } }

    @MainActor
    func start() {
        // .common: a pill drag runs the loop in tracking mode, and a default-mode timer would read it as a stall
        RunLoop.main.add(Timer(timeInterval: 0.5, repeats: true) { [last] _ in last.withLock { $0 = .now } }, forMode: .common)
        Thread.detachNewThread { [self] in
            var longest: Duration?
            while true {
                Thread.sleep(forTimeInterval: 1)
                let age = self.age
                if age > .seconds(2) {
                    if longest == nil { log("main: blocked for \(seconds(age))") }
                    longest = max(longest ?? .zero, age)
                } else if let stall = longest, age < .seconds(1) {
                    log("main: answering again after \(seconds(stall))+")
                    longest = nil
                }
            }
        }
    }
}

let heartbeat = Heartbeat()

func seconds(_ duration: Duration) -> String {
    String(format: "%.1f s", Double(duration.components.seconds) + Double(duration.components.attoseconds) / 1e18)
}

final class Control: @unchecked Sendable {
    private let queue = DispatchQueue(label: "x-speak.control")
    private var listener: NWListener?
    // the last status main gave, served with a «main» note while main cannot answer
    private let lastStatus = OSAllocatedUnfairLock<[String: Any]?>(uncheckedState: nil)

    func start() {
        unlink(controlSocket)
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = NWEndpoint.unix(path: controlSocket)
        do {
            let listener = try NWListener(using: parameters)
            listener.newConnectionHandler = { [self] connection in
                connection.start(queue: queue)
                read(connection, into: Data())
            }
            listener.stateUpdateHandler = { state in
                if case .failed(let error) = state { log("control: listener failed — \(error)") }
            }
            listener.start(queue: queue)
            self.listener = listener
            log("control: listening on \(controlSocket)")
        } catch {
            log("control: no socket — \(error)")
        }
    }

    private func read(_ connection: NWConnection, into buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [self] data, _, isComplete, error in
            var buffer = buffer
            if let data { buffer.append(data) }
            if let newline = buffer.firstIndex(of: 0x0A) {
                let reply = answer(Data(buffer[..<newline]))
                connection.send(content: reply + Data("\n".utf8), completion: .contentProcessed { _ in connection.cancel() })
            } else if isComplete || error != nil {
                connection.cancel()
            } else {
                read(connection, into: buffer)
            }
        }
    }

    // main gets a budget; past it the request is abandoned before it runs, so a preview never fires minutes late, and
    // a status falls back to main's last answer
    private func answer(_ line: Data) -> Data {
        guard let request = try? JSONDecoder().decode(Request.self, from: line) else { return reply(["error": "bad request"]) }
        let isStatus = request.op == "status"
        let state = OSAllocatedUnfairLock<(object: [String: Any]?, isRunning: Bool, isAbandoned: Bool)>(uncheckedState: (nil, false, false))
        let done = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                guard state.withLock({ current in
                    guard !current.isAbandoned else { return false }
                    current.isRunning = true
                    return true
                }) else { return }
                let object = self.handle(request)
                state.withLock { $0.object = object }
                done.signal()
            }
        }
        if done.wait(timeout: .now() + (isStatus ? .milliseconds(50) : .seconds(2))) == .timedOut {
            let isRunning = state.withLock { current in
                if !current.isRunning { current.isAbandoned = true }
                return current.isRunning
            }
            if isRunning {
                done.wait()
            } else {
                let note = "blocked for \(seconds(heartbeat.age))"
                if isStatus, var last = lastStatus.withLock({ $0 }) {
                    last["main"] = note
                    return reply(last)
                }
                return reply(["error": "main thread \(note), \(request.op) dropped", "main": note])
            }
        }
        let object = state.withLock { $0.object } ?? [:]
        if isStatus { lastStatus.withLock { $0 = object } }
        return reply(object)
    }

    @MainActor
    private func handle(_ request: Request) -> [String: Any] {
        switch request.op {
        case "status":
            return [
                "engines": speaker.health(), "accessibility": AXIsProcessTrusted(),
                "speaking": speaker.isSpeaking, "paused": speaker.panel.model.isPaused,
            ]
        case "voices":
            return ["system": installedVoices()]
        case "reload":
            let error = configFile.refresh()
            return error.map { ["error": $0] } ?? ["ok": true]
        // pause and resume, the pill's ⏸ from the admin
        case "pause":
            speaker.togglePause()
            return ["ok": true]
        case "stop":
            speaker.stop()
            speaker.panel.speechEnded()
            return ["ok": true]
        // shows the pill with sample levels, for screenshots of a design take
        case "panel-demo":
            speaker.panel.demo()
            return ["ok": true]
        case "wave":
            speaker.panel.wave(on: request.on ?? false, glide: request.glide, flow: request.flow)
            return ["ok": true]
        case "panel-hide":
            speaker.panel.hide()
            return ["ok": true]
        // a test hook: holds main for `seconds`, so the socket's answer under a blocked main can be measured
        case "block-main":
            let hold = request.seconds ?? 5
            DispatchQueue.main.async { Thread.sleep(forTimeInterval: hold) }
            return ["ok": true]
        case "preview":
            guard let engine = request.engine.flatMap(Engine.init), let text = request.text else { return ["error": "preview needs engine and text"] }
            speaker.preview(text, with: engine, settings: request.settings ?? config[engine])
            return ["ok": true]
        default:
            return ["error": "unknown op \(request.op)"]
        }
    }

    private func reply(_ object: [String: Any]) -> Data {
        (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
    }
}

// every installed en/uk/ru voice, best quality first — the mac voice card's dropdown
func installedVoices() -> [[String: String]] {
    AVSpeechSynthesisVoice.speechVoices()
        .filter { ["en", "uk", "ru"].contains(String($0.language.prefix(2))) && $0.gender == .female }
        .sorted { $0.quality.rawValue > $1.quality.rawValue }
        .map { ["id": $0.identifier, "name": $0.name, "lang": String($0.language.prefix(2)), "quality": ["", "default", "enhanced", "premium"][$0.quality.rawValue]] }
}

struct Request: Decodable {
    let op: String
    let engine: String?
    let text: String?
    let settings: EngineConfig?
    let on: Bool?
    let glide: Double?
    let flow: Double?
    let seconds: Double?
}
