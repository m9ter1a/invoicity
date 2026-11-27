import Foundation
import Vision
import PDFKit
import AppKit
let url = URL(fileURLWithPath: CommandLine.arguments[1])
func recognize(_ image: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US", "ru-RU"]
    try VNImageRequestHandler(cgImage: image).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}
func imageText(_ image: NSImage) throws -> String {
    var rect = CGRect(origin: .zero, size: image.size)
    guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return "" }
    return try recognize(cg)
}
do {
    if url.pathExtension.lowercased() == "pdf", let pdf = PDFDocument(url: url) {
        guard !pdf.isLocked else { throw NSError(domain: "PDF", code: 1) }
        for i in 0..<pdf.pageCount {
            if i > 0 { print("\u{000C}", terminator: "") }
            guard let page = pdf.page(at: i) else { continue }
            let text = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            print(text.isEmpty ? ((try? imageText(page.thumbnail(of: NSSize(width: 1700, height: 2200), for: .mediaBox))) ?? "") : text)
        }
    } else if let image = NSImage(contentsOf: url) { print(try imageText(image)) }
    else { exit(1) }
} catch { exit(1) }

