import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct PixelBuffer {
  let width: Int
  let height: Int
  var bytes: [UInt8]

  func offset(x: Int, y: Int) -> Int { (y * width + x) * 4 }
}

func fail(_ message: String) -> Never {
  fputs("icon-prep: \(message)\n", stderr)
  exit(1)
}

guard CommandLine.arguments.count == 3 else {
  fail("usage: swift IconPrep.swift <source.png> <output.png>")
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fail("could not read source PNG")
}

guard image.width == 1024, image.height == 1024 else {
  fail("canonical icon must remain 1024x1024; got \(image.width)x\(image.height)")
}

let width = image.width
let height = image.height
let colorSpace = CGColorSpaceCreateDeviceRGB()
var pixels = [UInt8](repeating: 0, count: width * height * 4)
let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
let created = pixels.withUnsafeMutableBytes { rawBuffer -> Bool in
  guard let baseAddress = rawBuffer.baseAddress,
        let context = CGContext(
          data: baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width * 4,
          space: colorSpace,
          bitmapInfo: bitmapInfo
        ) else {
    return false
  }
  context.interpolationQuality = .none
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  return true
}
guard created else { fail("could not rasterize source PNG") }

var buffer = PixelBuffer(width: width, height: height, bytes: pixels)
let corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
let cornerValues = corners.map { point -> (Int, Int, Int, Int) in
  let i = buffer.offset(x: point.0, y: point.1)
  return (Int(buffer.bytes[i]), Int(buffer.bytes[i + 1]), Int(buffer.bytes[i + 2]), Int(buffer.bytes[i + 3]))
}
let average = cornerValues.reduce((0, 0, 0, 0)) { partial, pixel in
  (partial.0 + pixel.0, partial.1 + pixel.1, partial.2 + pixel.2, partial.3 + pixel.3)
}
let background = (average.0 / 4, average.1 / 4, average.2 / 4, average.3 / 4)
let cornersAreTransparent = cornerValues.allSatisfy { $0.3 <= 8 }
let cornersAreNearBlack = cornerValues.allSatisfy { max($0.0, $0.1, $0.2) <= 48 && $0.3 >= 230 }

// If the source already has transparent corners, or its background is not the known
// near-black edge matte, preserve the canonical PNG byte-for-byte. This avoids any
// color-profile or antialiasing drift from an unnecessary rasterization round-trip.
if !cornersAreNearBlack {
  try? FileManager.default.removeItem(at: outputURL)
  do {
    try FileManager.default.copyItem(at: sourceURL, to: outputURL)
  } catch {
    fail("could not preserve canonical PNG: \(error.localizedDescription)")
  }
  let mode = cornersAreTransparent ? "existing-alpha-preserved" : "original-background-preserved"
  print("icon-prep: mode=\(mode) source=1024x1024 removed=0")
  exit(0)
}

var removed = 0
if cornersAreNearBlack {
  var visited = [Bool](repeating: false, count: width * height)
  var queue = [Int]()
  queue.reserveCapacity(width * 8)

  func matchesMatte(_ x: Int, _ y: Int) -> Bool {
    let i = buffer.offset(x: x, y: y)
    let r = Int(buffer.bytes[i])
    let g = Int(buffer.bytes[i + 1])
    let b = Int(buffer.bytes[i + 2])
    let a = Int(buffer.bytes[i + 3])
    return a >= 220 && max(r, g, b) <= 72 && abs(r - background.0) <= 28 && abs(g - background.1) <= 28 && abs(b - background.2) <= 28
  }

  func enqueue(_ x: Int, _ y: Int) {
    guard x >= 0, x < width, y >= 0, y < height else { return }
    let index = y * width + x
    guard !visited[index], matchesMatte(x, y) else { return }
    visited[index] = true
    queue.append(index)
  }

  for x in 0..<width {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for y in 0..<height {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  var cursor = 0
  while cursor < queue.count {
    let index = queue[cursor]
    cursor += 1
    let x = index % width
    let y = index / width
    let i = buffer.offset(x: x, y: y)
    buffer.bytes[i] = 0
    buffer.bytes[i + 1] = 0
    buffer.bytes[i + 2] = 0
    buffer.bytes[i + 3] = 0
    removed += 1
    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x, y - 1)
    enqueue(x, y + 1)
  }
}

for index in stride(from: 0, to: buffer.bytes.count, by: 4) where buffer.bytes[index + 3] == 0 {
  buffer.bytes[index] = 0
  buffer.bytes[index + 1] = 0
  buffer.bytes[index + 2] = 0
}

let outputImage: CGImage? = buffer.bytes.withUnsafeMutableBytes { rawBuffer in
  guard let baseAddress = rawBuffer.baseAddress,
        let context = CGContext(
          data: baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width * 4,
          space: colorSpace,
          bitmapInfo: bitmapInfo
        ) else {
    return nil
  }
  return context.makeImage()
}
guard let outputImage else { fail("could not create processed icon") }

guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fail("could not create output PNG")
}
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else { fail("could not write output PNG") }

if cornersAreNearBlack && removed == 0 {
  fail("detected a black edge matte but no edge-connected pixels were removed")
}

print("icon-prep: mode=edge-matte-removed source=1024x1024 removed=\(removed)")
