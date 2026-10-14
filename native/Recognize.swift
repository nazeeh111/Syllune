import Foundation
import Vision
import ImageIO

// Apple Vision runs locally. Output candidates are suggestions, never math verdicts.
guard CommandLine.arguments.count == 2 else { fputs("Expected a local image path.\n", stderr); exit(2) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["en-US"]
do {
    try VNImageRequestHandler(url: url, options: [:]).perform([request])
    let rows = (request.results ?? []).sorted { a, b in
        if abs(a.boundingBox.midY - b.boundingBox.midY) > 0.015 { return a.boundingBox.midY > b.boundingBox.midY }
        return a.boundingBox.minX < b.boundingBox.minX
    }.compactMap { item -> [String: Any]? in
        guard let candidate = item.topCandidates(1).first else { return nil }
        return ["text": candidate.string, "confidence": candidate.confidence,
                "box": ["x": item.boundingBox.minX, "y": 1 - item.boundingBox.maxY,
                        "width": item.boundingBox.width, "height": item.boundingBox.height]]
    }
    let data = try JSONSerialization.data(withJSONObject: ["lines": rows, "engine": "Apple Vision", "local": true])
    print(String(data: data, encoding: .utf8)!)
} catch { fputs("Unable to recognize this image: \(error.localizedDescription)\n", stderr); exit(1) }
