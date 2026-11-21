import AppKit
import Foundation
let output = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let size = points * scale
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { _ in
            let t = AffineTransform(scale: CGFloat(size) / 1024)
            (t as NSAffineTransform).concat()
            let bg = NSBezierPath(roundedRect: NSRect(x: 62, y: 62, width: 900, height: 900), xRadius: 205, yRadius: 205)
            NSColor(srgbRed: 0.11, green: 0.15, blue: 0.12, alpha: 1).setFill()
            bg.fill()
            NSColor(srgbRed: 0.77, green: 0.87, blue: 0.79, alpha: 1).setFill()
            for (x, y, h) in [(294, 258, 255), (452, 337, 360), (610, 516, 255)] {
                let p = NSBezierPath()
                p.move(to: NSPoint(x: x, y: y)); p.line(to: NSPoint(x: x + 120, y: y + 52))
                p.line(to: NSPoint(x: x + 120, y: y + h + 52)); p.line(to: NSPoint(x: x, y: y + h))
                p.close(); p.fill()
            }
            return true
        }
        var rect = NSRect(origin: .zero, size: image.size)
        let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
        let bitmap = NSBitmapImageRep(cgImage: cg)
        let suffix = scale == 2 ? "@2x" : ""
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("icon_\(points)x\(points)\(suffix).png"))
    }
}

