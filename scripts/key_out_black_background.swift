import AppKit
import CoreGraphics
import Foundation

struct PixelImage {
  let width: Int
  let height: Int
  let bytesPerRow: Int
  var data: [UInt8]
}

func loadImage(at url: URL) -> CGImage? {
  guard let image = NSImage(contentsOf: url) else {
    return nil
  }

  var rect = CGRect(origin: .zero, size: image.size)
  return image.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

func imageBytes(from image: CGImage) -> PixelImage? {
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

  context.interpolationQuality = .none
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  return PixelImage(width: width, height: height, bytesPerRow: bytesPerRow, data: data)
}

func brightness(of image: PixelImage, x: Int, y: Int) -> UInt8 {
  let index = y * image.bytesPerRow + x * 4
  let r = image.data[index]
  let g = image.data[index + 1]
  let b = image.data[index + 2]
  return max(r, max(g, b))
}

func alpha(of image: PixelImage, x: Int, y: Int) -> UInt8 {
  image.data[y * image.bytesPerRow + x * 4 + 3]
}

func setTransparent(_ image: inout PixelImage, x: Int, y: Int) {
  let index = y * image.bytesPerRow + x * 4
  image.data[index] = 0
  image.data[index + 1] = 0
  image.data[index + 2] = 0
  image.data[index + 3] = 0
}

func keyOutBorderBlack(_ image: inout PixelImage, threshold: UInt8 = 24) {
  let width = image.width
  let height = image.height
  var visited = [UInt8](repeating: 0, count: width * height)
  var queue = [(Int, Int)]()

  func enqueue(_ x: Int, _ y: Int) {
    let flat = y * width + x
    if visited[flat] == 1 {
      return
    }

    visited[flat] = 1
    if alpha(of: image, x: x, y: y) > 0 && brightness(of: image, x: x, y: y) <= threshold {
      queue.append((x, y))
    }
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
    let (x, y) = queue[cursor]
    cursor += 1
    setTransparent(&image, x: x, y: y)

    let neighbors = [
      (x - 1, y),
      (x + 1, y),
      (x, y - 1),
      (x, y + 1)
    ]

    for (nx, ny) in neighbors {
      if nx < 0 || ny < 0 || nx >= width || ny >= height {
        continue
      }

      let flat = ny * width + nx
      if visited[flat] == 1 {
        continue
      }

      visited[flat] = 1
      if alpha(of: image, x: nx, y: ny) > 0 && brightness(of: image, x: nx, y: ny) <= threshold {
        queue.append((nx, ny))
      }
    }
  }
}

func alphaBounds(of image: PixelImage) -> CGRect? {
  var minX = image.width
  var minY = image.height
  var maxX = -1
  var maxY = -1

  for y in 0..<image.height {
    for x in 0..<image.width {
      if alpha(of: image, x: x, y: y) == 0 {
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

func croppedImage(from image: PixelImage, bounds: CGRect, padding: Int = 2) -> PixelImage {
  let minX = max(0, Int(bounds.minX) - padding)
  let minY = max(0, Int(bounds.minY) - padding)
  let maxX = min(image.width - 1, Int(bounds.maxX) + padding)
  let maxY = min(image.height - 1, Int(bounds.maxY) + padding)
  let width = maxX - minX + 1
  let height = maxY - minY + 1
  let bytesPerRow = width * 4
  var data = [UInt8](repeating: 0, count: height * bytesPerRow)

  for y in 0..<height {
    let sourceOffset = (minY + y) * image.bytesPerRow + minX * 4
    let targetOffset = y * bytesPerRow
    data[targetOffset..<(targetOffset + bytesPerRow)] = image.data[sourceOffset..<(sourceOffset + bytesPerRow)]
  }

  return PixelImage(width: width, height: height, bytesPerRow: bytesPerRow, data: data)
}

func cgImage(from image: PixelImage) -> CGImage? {
  guard let provider = CGDataProvider(data: Data(image.data) as CFData) else {
    return nil
  }

  return CGImage(
    width: image.width,
    height: image.height,
    bitsPerComponent: 8,
    bitsPerPixel: 32,
    bytesPerRow: image.bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
    provider: provider,
    decode: nil,
    shouldInterpolate: false,
    intent: .defaultIntent
  )
}

func pngData(from image: CGImage) -> Data? {
  let rep = NSBitmapImageRep(cgImage: image)
  return rep.representation(using: .png, properties: [:])
}

if CommandLine.arguments.count < 3 {
  fputs("Usage: swift key_out_black_background.swift <input.png> <output.png>\n", stderr)
  exit(1)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let sourceImage = loadImage(at: inputURL),
      var bytes = imageBytes(from: sourceImage) else {
  fputs("Could not load source image\n", stderr)
  exit(1)
}

keyOutBorderBlack(&bytes)

guard let bounds = alphaBounds(of: bytes) else {
  fputs("Could not find opaque pixels after keying background\n", stderr)
  exit(1)
}

let cropped = croppedImage(from: bytes, bounds: bounds, padding: 2)

guard let outputImage = cgImage(from: cropped),
      let data = pngData(from: outputImage) else {
  fputs("Could not encode output image\n", stderr)
  exit(1)
}

try data.write(to: outputURL)
print("Saved cleaned PNG to \(outputURL.path)")
