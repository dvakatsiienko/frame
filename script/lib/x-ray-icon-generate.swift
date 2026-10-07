// Renders one emoji as an x-ray command tile. Invoked by `script/x-ray-icon-generate.ts`, never by hand.
//   swift script/lib/x-ray-icon-generate.swift <emoji> <out.png>
//
// Two passes, because emoji metrics lie. `size(withAttributes:)` reports the line box —
// ascender, descender and leading included — and for Apple Color Emoji that box is both
// taller than the glyph and off-centre against it. Sizing from it leaves a tile whose art
// drifts and never fills the same square twice. So pass one draws at a reference size and
// reads the opaque pixels back; pass two sizes and places from that measured box, which is
// the shape a human actually sees.
//
// No corner mask. The extension's image-sourced tiles (linear, currency, the extension icon)
// are 22 %-radius rounded squares filling the canvas, but its two emoji tiles — handoff and
// schedule — are bare glyphs on transparency, and a glyph scaled into a 424 px box never
// reaches the corners a 112 px radius would cut. Measured on ⬛ 🔲 🟦 🏁 📜 🚫: masked and
// unmasked renders are byte-identical.
import AppKit

let side = 512.0
// The shipped emoji tiles sit in a 424 px box — 44 px of air per edge.
let glyphBox = 424.0
let referenceSize = 400.0

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write("usage: x-ray-icon-generate.swift <emoji> <out.png>\n".data(using: .utf8)!)
    exit(2)
}
let emoji = CommandLine.arguments[1] as NSString
let outPath = CommandLine.arguments[2]

/* Helpers */
func makeCanvas() -> NSBitmapImageRep {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: Int(side), pixelsHigh: Int(side),
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: side, height: side)
    return rep
}

func draw(size: Double, at origin: NSPoint, into rep: NSBitmapImageRep) {
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    emoji.draw(at: origin, withAttributes: [.font: NSFont(name: "Apple Color Emoji", size: size)!])
    NSGraphicsContext.restoreGraphicsState()
}

/// Bounds of what is actually painted, in the bottom-left origin the drawing context uses.
func opaqueBounds(of rep: NSBitmapImageRep) -> NSRect? {
    var minX = Int(side), maxX = -1, minY = Int(side), maxY = -1
    for row in 0..<Int(side) {
        for column in 0..<Int(side) {
            guard let pixel = rep.colorAt(x: column, y: row), pixel.alphaComponent > 0.05
            else { continue }
            minX = min(minX, column); maxX = max(maxX, column)
            minY = min(minY, row); maxY = max(maxY, row)
        }
    }
    if maxX < 0 { return nil }

    // colorAt() counts rows from the top; the context counts them from the bottom.
    return NSRect(
        x: Double(minX), y: side - Double(maxY + 1),
        width: Double(maxX - minX + 1), height: Double(maxY - minY + 1))
}

/* Pass one — where does this glyph actually land */
let probe = makeCanvas()
draw(size: referenceSize, at: .zero, into: probe)
guard let painted = opaqueBounds(of: probe) else {
    FileHandle.standardError.write("\"\(emoji)\" painted no pixels — not an emoji this font carries.\n".data(using: .utf8)!)
    exit(1)
}
// The probe draws from the origin outward, so an unusually wide sequence could run off the
// canvas and be measured short. Loud beats a quietly cropped icon.
guard painted.maxX < side - 1, painted.maxY < side - 1 else {
    FileHandle.standardError.write("\"\(emoji)\" overruns the probe canvas at \(Int(referenceSize)) pt — lower referenceSize.\n".data(using: .utf8)!)
    exit(1)
}

/* Pass two — size it to the box and centre what was measured, not what the metrics claimed */
let scale = glyphBox / max(painted.width, painted.height)
let placed = NSPoint(
    x: (side - painted.width * scale) / 2 - painted.minX * scale,
    y: (side - painted.height * scale) / 2 - painted.minY * scale)

let tile = makeCanvas()
draw(size: referenceSize * scale, at: placed, into: tile)

guard let png = tile.representation(using: .png, properties: [:]) else { exit(1) }
try png.write(to: URL(fileURLWithPath: outPath))

let final = opaqueBounds(of: tile) ?? .zero
print("\(Int(side))x\(Int(side)) · glyph \(Int(final.width))x\(Int(final.height)) at x \(Int(final.minX)) y \(Int(final.minY))")
