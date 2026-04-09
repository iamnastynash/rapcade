import AppKit
import CoreGraphics
import Foundation

struct ImageBytes {
  let width: Int
  let height: Int
  let bytesPerRow: Int
  let data: [UInt8]
}

func loadImage(at url: URL) -> CGImage? {
  guard let nsImage = NSImage(contentsOf: url) else {
    return nil
  }

  var rect = CGRect(origin: .zero, size: nsImage.size)
  return nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

func imageBytes(from image: CGImage) -> ImageBytes? {
  let width = image.width
  let height = image.height
  let bytesPerRow = width * 4
  var data = [UInt8](repeating: 0, count: height * bytesPerRow)

  guard let context = CGContext(
    data: &data,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    return nil
  }

  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  return ImageBytes(width: width, height: height, bytesPerRow: bytesPerRow, data: data)
}

func alphaBounds(of image: CGImage) -> CGRect? {
  guard let bytes = imageBytes(from: image) else {
    return nil
  }

  var minX = bytes.width
  var minY = bytes.height
  var maxX = -1
  var maxY = -1

  for y in 0..<bytes.height {
    for x in 0..<bytes.width {
      let alpha = bytes.data[y * bytes.bytesPerRow + x * 4 + 3]
      if alpha == 0 {
        continue
      }

      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)
    }
  }

  if maxX < minX || maxY < minY {
    return nil
  }

  return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

func unionRect(_ a: CGRect, _ b: CGRect) -> CGRect {
  CGRect(
    x: min(a.minX, b.minX),
    y: min(a.minY, b.minY),
    width: max(a.maxX, b.maxX) - min(a.minX, b.minX),
    height: max(a.maxY, b.maxY) - min(a.minY, b.minY)
  )
}

func cropImage(_ image: CGImage, to rect: CGRect) -> CGImage? {
  let clampedX = max(0, Int(rect.origin.x))
  let clampedY = max(0, Int(rect.origin.y))
  let clampedWidth = min(image.width - clampedX, Int(rect.width))
  let clampedHeight = min(image.height - clampedY, Int(rect.height))
  let cropRect = CGRect(
    x: clampedX,
    y: clampedY,
    width: max(1, clampedWidth),
    height: max(1, clampedHeight)
  )
  return image.cropping(to: cropRect)
}

func resizeImage(_ image: CGImage, width: Int, height: Int) -> CGImage? {
  guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    return nil
  }

  context.interpolationQuality = .none
  context.clear(CGRect(x: 0, y: 0, width: width, height: height))
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  return context.makeImage()
}

func pngData(from image: CGImage) -> Data? {
  let rep = NSBitmapImageRep(cgImage: image)
  return rep.representation(using: .png, properties: [:])
}

if CommandLine.arguments.count < 5 {
  fputs("Usage: swift build_png_strip.swift <output.png> <frame-width> <frame-height> <input1> [input2 ...]\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let frameWidth = Int(CommandLine.arguments[2]) ?? 240
let frameHeight = Int(CommandLine.arguments[3]) ?? 180
let inputURLs = CommandLine.arguments.dropFirst(4).map { URL(fileURLWithPath: $0) }

var sourceImages = [CGImage]()
var unionBounds: CGRect?

for url in inputURLs {
  guard let image = loadImage(at: url) else {
    fputs("Could not load \(url.path)\n", stderr)
    exit(1)
  }

  sourceImages.append(image)

  if let bounds = alphaBounds(of: image) {
    let padded = bounds.insetBy(dx: -18, dy: -18)
    unionBounds = unionBounds == nil ? padded : unionRect(unionBounds!, padded)
  }
}

var frames = [CGImage]()
for (index, image) in sourceImages.enumerated() {
  let working = unionBounds.flatMap { cropImage(image, to: $0) } ?? image

  guard let resized = resizeImage(working, width: frameWidth, height: frameHeight) else {
    fputs("Could not process frame \(index + 1)\n", stderr)
    exit(1)
  }
  frames.append(resized)
}

let outputWidth = frameWidth * frames.count
guard let context = CGContext(
  data: nil,
  width: outputWidth,
  height: frameHeight,
  bitsPerComponent: 8,
  bytesPerRow: outputWidth * 4,
  space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fputs("Could not create output context\n", stderr)
  exit(1)
}

context.interpolationQuality = .none
context.clear(CGRect(x: 0, y: 0, width: outputWidth, height: frameHeight))

for (index, frame) in frames.enumerated() {
  let x = index * frameWidth
  context.draw(frame, in: CGRect(x: x, y: 0, width: frameWidth, height: frameHeight))
}

guard let outputImage = context.makeImage(),
      let data = pngData(from: outputImage) else {
  fputs("Could not encode output image\n", stderr)
  exit(1)
}

try data.write(to: outputURL)
print("Saved strip to \(outputURL.path)")
