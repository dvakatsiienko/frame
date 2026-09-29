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
    @Published var levels = [Float](repeating: 0, count: 26)
    // which button the pointer is over; lives here because a plain swiftc build has no SwiftUI @State macro
    @Published var hovered: String?

    var onClose: () -> Void = {}
    var onPause: () -> Void = {}
    var onStop: () -> Void = {}
    var onUnstick: () -> Void = {}

    func push(_ level: Float) {
        guard !isPaused else { return }
        levels.removeFirst()
        levels.append(level)
    }

    func resetLevels() {
        levels = [Float](repeating: 0, count: levels.count)
    }
}

struct PanelView: View {
    @ObservedObject var model: PanelModel

    var body: some View {
        HStack(spacing: 6) {
            PillButton(model: model, symbol: "xmark", label: "Close the panel, keep speaking", action: model.onClose)
            LevelMeter(levels: model.levels)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 6)
            PillButton(model: model, symbol: model.isPaused ? "play.fill" : "pause.fill", label: model.isPaused ? "Resume" : "Pause", action: model.onPause)
            PillButton(model: model, symbol: "stop.fill", label: "Stop · F5", hint: "F5", action: model.onStop)
            PillButton(model: model, symbol: model.isSticky ? "pin.fill" : "pin", label: model.isSticky ? "Unstick" : "Stick: stay after speech ends", isOn: model.isSticky) {
                model.isSticky.toggle()
                if !model.isSticky { model.onUnstick() }
            }
        }
        .padding(.horizontal, 8)
        .frame(width: 300, height: 44)
        .background(VisualEffect())
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.12), lineWidth: 1))
    }
}

struct LevelMeter: View {
    let levels: [Float]

    var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(levels.indices, id: \.self) { index in
                Capsule()
                    .fill(Color.primary.opacity(0.7))
                    .frame(width: 2.5, height: max(3, CGFloat(levels[index]) * 24))
            }
        }
        .frame(height: 24)
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
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isOn ? Color.accentColor : Color.primary.opacity(0.85))
                if let hint {
                    Text(hint)
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color.primary.opacity(0.18), lineWidth: 1))
                }
            }
            .padding(.horizontal, hint == nil ? 0 : 7)
            .frame(minWidth: 28, minHeight: 28)
            .background(Capsule().fill(Color.primary.opacity(isHovered ? 0.1 : 0)))
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
        view.material = .popover
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
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 44),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: true,
        )
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isMovableByWindowBackground = true
        panel.hidesOnDeactivate = false
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = true
        panel.contentView = NSHostingView(rootView: PanelView(model: model))
        // first show: bottom centre, above the dock; after a drag, wherever dima left it
        if !panel.setFrameUsingName("x-speak.panel"), let screen = NSScreen.main?.visibleFrame {
            panel.setFrameOrigin(NSPoint(x: screen.midX - 150, y: screen.minY + 24))
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

    func demo(appearance: NSAppearance.Name) {
        window.appearance = NSAppearance(named: appearance)
        model.levels = (0..<model.levels.count).map { index in Float(0.25 + 0.6 * abs(sin(Double(index) * 0.7))) }
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
