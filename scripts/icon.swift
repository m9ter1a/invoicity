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
            NSColor.black.setFill()
            bg.fill()
            let smile = NSAttributedString(string: "=)", attributes: [
                .font: NSFont.monospacedSystemFont(ofSize: 375, weight: .medium),
                .foregroundColor: NSColor.white
            ])
            let bounds = smile.boundingRect(with: NSSize(width: 900, height: 900),
                                             options: [.usesDeviceMetrics])
            smile.draw(at: NSPoint(x: 512 - bounds.midX, y: 512 - bounds.midY))
            return true
        }
        var rect = NSRect(origin: .zero, size: image.size)
        let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
        let bitmap = NSBitmapImageRep(cgImage: cg)
        let suffix = scale == 2 ? "@2x" : ""
        try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("icon_\(points)x\(points)\(suffix).png"))
    }
}

