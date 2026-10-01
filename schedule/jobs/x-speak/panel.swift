// the floating pill while x-speak talks: close, a level meter, pause, stop, stick. never takes focus, floats on
// every space, drags anywhere and remembers where. the meter is the one moving part: the mixer's real level, drawn
// at the display's refresh rate while audio plays and still otherwise — cut `LevelMeter` and `Player.onLevel` to drop it.
import AppKit
import SwiftUI

@MainActor
final class PanelModel: ObservableObject {
    @Published var isPaused = false
    // the pause button follows the speech: ⏸ while it talks, ▶ while paused, a dim ▶ when nothing plays
    @Published var isSpeaking = false
    @Published var isSticky = UserDefaults.standard.bool(forKey: "panelSticky") {
        didSet { UserDefaults.standard.set(isSticky, forKey: "panelSticky") }
    }
    // read by the meter every frame, never observed: a new reading costs no view update
    let meter = Meter()
    // flips once per speech, on the first audible reading: the mac voice plays outside the audio engine and sends
    // none, so its speech never runs the meter's timeline
    @Published var hasSignal = false
    // which button the pointer is over; lives here because a plain swiftc build has no SwiftUI @State macro
    @Published var hovered: String?

    var onClose: () -> Void = {}
    var onPause: () -> Void = {}
    var onStop: () -> Void = {}
    var onUnstick: () -> Void = {}
    var onDrag: () -> Void = {}
    var onDragEnd: () -> Void = {}

    func push(_ levels: [Float], spacing: TimeInterval) {
        guard !isPaused else { return }
        meter.enqueue(levels, spacing: spacing)
        if !hasSignal, levels.contains(where: { $0 > 0.04 }) { hasSignal = true }
    }

    func resetLevels() {
        meter.reset()
        hasSignal = false
    }
}

// the level history (newest first, mirrored out from the centre) and the bars as drawn. readings play out ~100 times
// a second, 10 ms apart; every display frame each bar glides a share of the way to its reading (pill glide), so the
// meter flows instead of stepping (dima: «smooth, like requestAnimationFrame»)
@MainActor
final class Meter {
    private var history = [Float](repeating: 0, count: 9)
    private var shown = [Float](repeating: 0, count: 17)
    // centre-heavy envelope: the edges reach ~40 % of the centre, so the meter reads as a curve, never a full block
    private let envelope: [Float] = (0..<17).map { index in
        let distance = Float(abs(index - 8)) / 8
        return 0.4 + 0.6 * pow(cos(distance * .pi / 2), 2)
    }
    private var lastFrame: Date?
    // readings waiting for their moment: a 100 ms buffer's ten windows, each due 10 ms after the last
    private var pending: [(due: Date, level: Float)] = []

    // a reading still undrawn a second past its moment is dropped: with the timeline paused and the tap still feeding,
    // five idle hours piled up ~1.8 M readings, and the next frame spent 6.5 min of main draining them
    func enqueue(_ levels: [Float], spacing: TimeInterval) {
        let now = Date()
        pending.removeFirst(pending.prefix { $0.due < now.addingTimeInterval(-1) }.count)
        let start = max(now, pending.last.map { $0.due.addingTimeInterval(spacing) } ?? .distantPast)
        pending += levels.enumerated().map { (start.addingTimeInterval(Double($0.offset) * spacing), $0.element) }
    }

    // readings arrive every 10 ms; the wave moves one bar outward per meterFlowMs, carrying the loudest reading of
    // that span, so the travel speed is a setting and not the audio's buffer rate
    private var stepPeak: Float = 0
    private var stepReadings = 0

    func push(_ level: Float) {
        stepPeak = max(stepPeak, level)
        stepReadings += 1
        guard stepReadings >= max(1, Int(((waveTuning?.flow ?? config.meterFlowMs) / 10).rounded())) else { return }
        // a short decay, so a pause between words does not snap the centre bar to a dot
        history.removeLast()
        history.insert(max(stepPeak, (history.first ?? 0) * 0.72), at: 0)
        stepPeak = 0
        stepReadings = 0
    }

    func reset() {
        pending = []
        stepPeak = 0
        stepReadings = 0
        history = history.map { _ in 0 }
        shown = shown.map { _ in 0 }
        lastFrame = nil
    }

    func show(_ levels: [Float]) {
        history = levels
        shown = history.reversed() + history.dropFirst()
    }

    // one display frame: a frame-rate-independent ease; config's meterGlideMs is the time to cover most of the gap
    func frame(at date: Date) -> [Float] {
        let dt = lastFrame.map { min(0.1, date.timeIntervalSince($0)) } ?? 1.0 / 60
        lastFrame = date
        let due = pending.prefix { $0.due <= date }
        due.forEach { push($0.level) }
        pending.removeFirst(due.count)
        let ease = Float(1 - exp(-dt / max(0.0001, (waveTuning?.glide ?? config.meterGlideMs) / 1000)))
        let raw = history.reversed() + history.dropFirst()
        // a light blur across neighbours, so the wave reads as one flowing shape, not 17 independent bars
        let target = raw.indices.map { index in
            let left = raw[max(0, index - 1)], right = raw[min(raw.count - 1, index + 1)]
            return (left + 2 * raw[index] + right) / 4 * envelope[index]
        }
        for index in shown.indices { shown[index] += (target[index] - shown[index]) * ease }
        return shown
    }
}

struct PanelView: View {
    @ObservedObject var model: PanelModel

    var body: some View {
        HStack(spacing: 2) {
            PillButton(model: model, symbol: "xmark", label: "Close the panel, keep speaking", action: model.onClose)
            LevelMeter(meter: model.meter, isRunning: model.isSpeaking && !model.isPaused && model.hasSignal)
                .frame(maxWidth: .infinity)
            PillButton(
                model: model,
                symbol: model.isSpeaking && !model.isPaused ? "pause.fill" : "play.fill",
                label: !model.isSpeaking ? "Nothing playing" : model.isPaused ? "Resume · F4" : "Pause · F4",
                isDisabled: !model.isSpeaking,
                action: model.onPause,
            )
            PillButton(model: model, symbol: "stop.fill", label: "Stop · F5", hint: "F5", action: model.onStop)
            PillButton(model: model, symbol: model.isSticky ? "pin.fill" : "pin", label: model.isSticky ? "Unstick" : "Stick: stay after speech ends", isOn: model.isSticky) {
                model.isSticky.toggle()
                if !model.isSticky { model.onUnstick() }
            }
        }
        .padding(.horizontal, 6)
        .frame(width: panelSize.width, height: panelSize.height)
        // the tint sits over the glass: a second .background would land behind it and vanish
        .background(ZStack { VisualEffect(); Color.black.opacity(0.55) })
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Color.white.opacity(0.14), lineWidth: 1))
        // the whole pill drags; a button's own click wins over this gesture. isMovableByWindowBackground never
        // fired under SwiftUI (dima's hand test, take 2)
        .contentShape(Capsule())
        .gesture(DragGesture(minimumDistance: 2).onChanged { _ in model.onDrag() }.onEnded { _ in model.onDragEnd() })
        .environment(\.colorScheme, .dark)
    }
}

// the one accent (Linear's indigo), on live bars only; at rest the bars are dim dots
let meterAccent = Color(red: 0.56, green: 0.58, blue: 1.0)
let panelSize = CGSize(width: 236, height: 36)

// the infinite waveform's unsaved glide and flow, in force only while it runs
@MainActor var waveTuning: (glide: Double, flow: Double)?

// a talking voice without the voice: ~4 syllables a second inside ~1.6 s phrases, a short breath between them
func speechLevel(at t: Double) -> Double {
    let phrase = t.truncatingRemainder(dividingBy: 1.6)
    guard phrase < 1.3 else { return 0.02 }
    let syllable = abs(sin(t * .pi * 4.2))
    let texture = 0.5 + 0.5 * sin(t * 37) * sin(t * 13)
    return min(0.95, 0.25 + 0.45 * syllable + 0.15 * texture)
}

// newest level in the centre, older ones moving outward on both sides. a 60 fps timeline while speech with a signal
// plays — measured: +7 % of one core at 60, +11 % at 120, with the eased bars equally smooth to the eye; paused,
// stopped, idle or on the mac voice it draws once and holds
struct LevelMeter: View {
    let meter: Meter
    let isRunning: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 120, paused: !isRunning)) { context in
            Canvas { canvas, size in
                let levels = meter.frame(at: context.date)
                let width: CGFloat = 2.5
                let gap: CGFloat = 2.5
                var x = (size.width - CGFloat(levels.count) * (width + gap) + gap) / 2
                for level in levels {
                    let height = max(width, CGFloat(level) * size.height)
                    let bar = CGRect(x: x, y: (size.height - height) / 2, width: width, height: height)
                    canvas.fill(Path(roundedRect: bar, cornerRadius: width / 2), with: .color(level > 0.04 ? meterAccent : Color.white.opacity(0.22)))
                    x += width + gap
                }
            }
        }
        .frame(height: 20)
        .accessibilityHidden(true)
    }
}

struct PillButton: View {
    @ObservedObject var model: PanelModel
    let symbol: String
    let label: String
    var hint: String?
    var isOn = false
    var isDisabled = false
    let action: () -> Void

    private var isHovered: Bool { model.hovered == label }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(isOn ? 1 : 0.72))
                if let hint {
                    Text(hint)
                        .font(.system(size: 9, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.5))
                        .padding(.horizontal, 3)
                        .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(Color.white.opacity(0.18), lineWidth: 1))
                }
            }
            .padding(.horizontal, hint == nil ? 0 : 6)
            .frame(minWidth: 26, minHeight: 26)
            .background(Capsule().fill(Color.white.opacity(isHovered ? 0.12 : 0)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.35 : 1)
        .help(label)
        .accessibilityLabel(label)
        .onHover { isHovered in
            model.hovered = isHovered ? label : nil
            if isHovered { NSCursor.pointingHand.push() } else { NSCursor.pop() }
        }
    }
}

// the frosted material, following the system appearance
struct VisualEffect: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .hudWindow
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {}
}

@MainActor
final class Panel {
    let model = PanelModel()
    private lazy var window: NSPanel = {
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: panelSize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: true,
        )
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.hidesOnDeactivate = false
        panel.backgroundColor = .clear
        // dark glass in both system themes, the Whispr feel
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isOpaque = false
        panel.hasShadow = true
        panel.contentView = NSHostingView(rootView: PanelView(model: model))
        return panel
    }()
    private var dragStart: (mouse: NSPoint, origin: NSPoint)?

    init() {
        model.onDrag = { [weak self] in self?.drag() }
        model.onDragEnd = { [weak self] in self?.dragEnded() }
    }

    private func drag() {
        let mouse = NSEvent.mouseLocation
        let start = dragStart ?? (mouse, window.frame.origin)
        dragStart = start
        window.setFrameOrigin(NSPoint(x: start.origin.x + mouse.x - start.mouse.x, y: start.origin.y + mouse.y - start.mouse.y))
    }

    // where the pill sits is remembered per display, as an offset inside that display's visible frame
    private func dragEnded() {
        dragStart = nil
        let centre = NSPoint(x: window.frame.midX, y: window.frame.midY)
        guard let screen = NSScreen.screens.first(where: { $0.frame.contains(centre) }) ?? window.screen else { return }
        var positions = UserDefaults.standard.dictionary(forKey: "panelPositions") as? [String: [Double]] ?? [:]
        positions[Self.key(screen)] = [window.frame.minX - screen.visibleFrame.minX, window.frame.minY - screen.visibleFrame.minY]
        UserDefaults.standard.set(positions, forKey: "panelPositions")
    }

    // the screen under the pointer, at its remembered spot or bottom centre above the dock
    private func placeOnPointerScreen() {
        let mouse = NSEvent.mouseLocation
        guard let screen = NSScreen.screens.first(where: { $0.frame.contains(mouse) }) ?? NSScreen.main else { return }
        let area = screen.visibleFrame
        let saved = (UserDefaults.standard.dictionary(forKey: "panelPositions") as? [String: [Double]])?[Self.key(screen)]
        let offset = saved.map { NSPoint(x: $0[0], y: $0[1]) } ?? NSPoint(x: (area.width - panelSize.width) / 2, y: 24)
        window.setFrameOrigin(NSPoint(
            x: area.minX + min(max(0, offset.x), area.width - panelSize.width),
            y: area.minY + min(max(0, offset.y), area.height - panelSize.height),
        ))
    }

    private static func key(_ screen: NSScreen) -> String {
        let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID ?? 0
        return CGDisplayCreateUUIDFromDisplayID(number).map { CFUUIDCreateString(nil, $0.takeRetainedValue()) as String } ?? "\(number)"
    }

    var isVisible: Bool { window.isVisible }

    func show() {
        model.isPaused = false
        model.isSpeaking = true
        if !window.isVisible { placeOnPointerScreen() }
        window.orderFrontRegardless()
    }

    func hide() {
        window.orderOut(nil)
        model.resetLevels()
    }

    // the admin's infinite waveform: speech-shaped levels with no audio, so glide and flow can be tuned by eye with
    // their unsaved values. every call re-arms a 5-minute deadline; an admin tab that vanished cannot leave it running
    private var waveTimer: Timer?
    private var waveDeadline = Date.distantPast

    func wave(on: Bool, glide: Double?, flow: Double?) {
        guard on else { return stopWave() }
        waveTuning = (glide ?? waveTuning?.glide ?? config.meterGlideMs, flow ?? waveTuning?.flow ?? config.meterFlowMs)
        waveDeadline = Date().addingTimeInterval(300)
        guard waveTimer == nil else { return }
        model.isPaused = false
        model.isSpeaking = true
        if !window.isVisible { placeOnPointerScreen() }
        window.orderFrontRegardless()
        let start = Date()
        waveTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                if Date() > self.waveDeadline { return self.stopWave() }
                let t0 = Date().timeIntervalSince(start)
                self.model.push((0..<10).map { Float(speechLevel(at: t0 + Double($0) * 0.01)) }, spacing: 0.01)
            }
        }
    }

    func stopWave() {
        guard let timer = waveTimer else { return }
        timer.invalidate()
        waveTimer = nil
        waveTuning = nil
        speechEnded()
    }

    func demo() {
        model.meter.show((0..<9).map { index in Float(0.85 - Double(index) * 0.08 + 0.12 * sin(Double(index) * 1.9)) })
        model.isSpeaking = true
        if !window.isVisible { placeOnPointerScreen() }
        window.orderFrontRegardless()
    }

    var windowNumber: Int { window.windowNumber }

    // speech is over: the panel goes too, unless stick holds it
    func speechEnded() {
        model.isPaused = false
        model.isSpeaking = false
        model.resetLevels()
        if !model.isSticky { hide() }
    }
}
