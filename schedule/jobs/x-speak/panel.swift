// the floating pill while x-speak talks: close, a level meter, pause, stop, stick. never takes focus, floats on
// every space, drags anywhere and remembers where. the meter is the one moving part: the mixer's real level at
// ≤20 fps, only while audio plays — cut `LevelMeter` and `Player.onLevel` to drop it.
import AppKit
import SwiftUI

@MainActor
final class PanelModel: ObservableObject {
    @Published var isPaused = false
    @Published var isSticky = UserDefaults.standard.bool(forKey: "panelSticky") {
        didSet { UserDefaults.standard.set(isSticky, forKey: "panelSticky") }
    }
    // newest first; the meter mirrors it out from the centre
    @Published var levels = [Float](repeating: 0, count: 9)
    // which button the pointer is over; lives here because a plain swiftc build has no SwiftUI @State macro
    @Published var hovered: String?

    var onClose: () -> Void = {}
    var onPause: () -> Void = {}
    var onStop: () -> Void = {}
    var onUnstick: () -> Void = {}

    func push(_ level: Float) {
        guard !isPaused else { return }
        levels.removeLast()
        levels.insert(level, at: 0)
    }

    func resetLevels() {
        levels = [Float](repeating: 0, count: levels.count)
    }
}

struct PanelView: View {
    @ObservedObject var model: PanelModel

    var body: some View {
        HStack(spacing: 2) {
            PillButton(model: model, symbol: "xmark", label: "Close the panel, keep speaking", action: model.onClose)
            LevelMeter(levels: model.levels)
                .frame(maxWidth: .infinity)
            PillButton(model: model, symbol: model.isPaused ? "play.fill" : "pause.fill", label: model.isPaused ? "Resume" : "Pause", action: model.onPause)
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
        .environment(\.colorScheme, .dark)
    }
}

// the one accent (Linear's indigo), on live bars only; at rest the bars are dim dots
let meterAccent = Color(red: 0.56, green: 0.58, blue: 1.0)
let panelSize = CGSize(width: 236, height: 36)

// newest level in the centre, older ones moving outward on both sides
struct LevelMeter: View {
    let levels: [Float]

    var body: some View {
        let mirrored = levels.reversed() + levels.dropFirst()
        HStack(alignment: .center, spacing: 2.5) {
            ForEach(Array(mirrored.enumerated()), id: \.offset) { _, level in
                Capsule()
                    .fill(level > 0.04 ? meterAccent : Color.white.opacity(0.22))
                    .frame(width: 2.5, height: max(2.5, CGFloat(level) * 20))
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
        panel.isMovableByWindowBackground = true
        panel.hidesOnDeactivate = false
        panel.backgroundColor = .clear
        // dark glass in both system themes, the Whispr feel
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isOpaque = false
        panel.hasShadow = true
        panel.contentView = NSHostingView(rootView: PanelView(model: model))
        // first show: bottom centre, above the dock; after a drag, wherever dima left it
        if !panel.setFrameUsingName("x-speak.panel"), let screen = NSScreen.main?.visibleFrame {
            panel.setFrameOrigin(NSPoint(x: screen.midX - panelSize.width / 2, y: screen.minY + 24))
        }
        panel.setFrameAutosaveName("x-speak.panel")
        return panel
    }()

    var isVisible: Bool { window.isVisible }

    func show() {
        model.isPaused = false
        window.orderFrontRegardless()
    }

    func hide() {
        window.orderOut(nil)
        model.resetLevels()
    }

    func demo() {
        model.levels = (0..<model.levels.count).map { index in Float(0.85 - Double(index) * 0.08 + 0.12 * sin(Double(index) * 1.9)) }
        window.orderFrontRegardless()
    }

    var windowNumber: Int { window.windowNumber }

    // speech is over: the panel goes too, unless stick holds it
    func speechEnded() {
        model.isPaused = false
        model.resetLevels()
        if !model.isSticky { hide() }
    }
}
