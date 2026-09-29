// the admin page's door into the running daemon: one json line in, one json line out, over a unix socket
// only this user can open. previews go through the daemon's own speak path, never a second synth.
import ApplicationServices
import AVFoundation
import Foundation
import Network

let controlSocket = NSHomeDirectory() + "/.local/share/x-speak/control.sock"

@MainActor
final class Control {
    private var listener: NWListener?

    func start() {
        unlink(controlSocket)
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = NWEndpoint.unix(path: controlSocket)
        do {
            let listener = try NWListener(using: parameters)
            listener.newConnectionHandler = { connection in
                Task { @MainActor in self.serve(connection) }
            }
            listener.stateUpdateHandler = { state in
                if case .failed(let error) = state { log("control: listener failed — \(error)") }
            }
            listener.start(queue: .main)
            self.listener = listener
            log("control: listening on \(controlSocket)")
        } catch {
            log("control: no socket — \(error)")
        }
    }

    private func serve(_ connection: NWConnection) {
        connection.start(queue: .main)
        read(connection, into: Data())
    }

    private func read(_ connection: NWConnection, into buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, isComplete, error in
            Task { @MainActor in
                var buffer = buffer
                if let data { buffer.append(data) }
                if let newline = buffer.firstIndex(of: 0x0A) {
                    let reply = await self.handle(buffer[..<newline])
                    connection.send(content: reply + Data("\n".utf8), completion: .contentProcessed { _ in connection.cancel() })
                } else if isComplete || error != nil {
                    connection.cancel()
                } else {
                    self.read(connection, into: buffer)
                }
            }
        }
    }

    private func handle(_ line: Data) async -> Data {
        guard let request = try? JSONDecoder().decode(Request.self, from: line) else { return reply(["error": "bad request"]) }
        switch request.op {
        case "status":
            return reply(["engines": speaker.health(), "accessibility": AXIsProcessTrusted(), "speaking": speaker.isSpeaking])
        case "voices":
            return reply(["system": installedVoices()])
        case "reload":
            let error = configFile.refresh()
            return reply(error.map { ["error": $0] } ?? ["ok": true])
        case "stop":
            speaker.stop()
            return reply(["ok": true])
        case "preview":
            guard let engine = request.engine.flatMap(Engine.init), let text = request.text else { return reply(["error": "preview needs engine and text"]) }
            speaker.preview(text, with: engine, settings: request.settings ?? config[engine])
            return reply(["ok": true])
        default:
            return reply(["error": "unknown op \(request.op)"])
        }
    }

    private func reply(_ object: [String: Any]) -> Data {
        (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
    }
}

// every installed en/uk/ru voice, best quality first — the mac voice card's dropdown
func installedVoices() -> [[String: String]] {
    AVSpeechSynthesisVoice.speechVoices()
        .filter { ["en", "uk", "ru"].contains(String($0.language.prefix(2))) }
        .sorted { $0.quality.rawValue > $1.quality.rawValue }
        .map { ["id": $0.identifier, "name": $0.name, "lang": String($0.language.prefix(2)), "quality": ["", "default", "enhanced", "premium"][$0.quality.rawValue]] }
}

struct Request: Decodable {
    let op: String
    let engine: String?
    let text: String?
    let settings: EngineConfig?
}
