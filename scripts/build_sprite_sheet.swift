import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct ImageBytes {
  let width: Int
  let height: Int
  let bytesPerRow: Int
  var data: [UInt8]
}

struct Component {
  let pixels: [Int]
  let area: Int
  let bounds: CGRect
}

func loadCGImage(from url: URL) -> CGImage? {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
    return nil
  }
  return CGImageSourceCreateImageAtIndex(source, 0, nil)
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

func isCheckerboardPixel(r: UInt8, g: UInt8, b: UInt8, a: UInt8) -> Bool {
  if a < 200 {
    return false
  }

  let drg = abs(Int(r) - Int(g))
  let dgb = abs(Int(g) - Int(b))
  let intensity = Int((UInt16(r) + UInt16(g) + UInt16(b)) / 3)

  return drg < 10 && dgb < 10 && (
    abs(intensity - 185) < 26 ||
    abs(intensity - 146) < 26
  )
}

func largestCheckerboardBounds(in image: ImageBytes) -> CGRect? {
  let width = image.width
  let height = image.height
  var visited = [UInt8](repeating: 0, count: width * height)

  var bestArea = 0
  var bestRect: CGRect?

  for y in 0..<height {
    for x in 0..<width {
      let flatIndex = y * width + x
      if visited[flatIndex] == 1 {
        continue
      }

      let byteIndex = y * image.bytesPerRow + x * 4
      let r = image.data[byteIndex]
      let g = image.data[byteIndex + 1]
      let b = image.data[byteIndex + 2]
      let a = image.data[byteIndex + 3]

      if !isCheckerboardPixel(r: r, g: g, b: b, a: a) {
        visited[flatIndex] = 1
        continue
      }

      var queue = [flatIndex]
      visited[flatIndex] = 1
      var area = 0
      var minX = x
      var maxX = x
      var minY = y
      var maxY = y
      var pointer = 0

      while pointer < queue.count {
        let current = queue[pointer]
        pointer += 1
        area += 1

        let cx = current % width
        let cy = current / width
        minX = min(minX, cx)
        maxX = max(maxX, cx)
        minY = min(minY, cy)
        maxY = max(maxY, cy)

        let neighbors = [
          (cx - 1, cy),
          (cx + 1, cy),
          (cx, cy - 1),
          (cx, cy + 1)
        ]

        for (nx, ny) in neighbors {
          if nx < 0 || ny < 0 || nx >= width || ny >= height {
            continue
          }

          let nFlat = ny * width + nx
          if visited[nFlat] == 1 {
            continue
          }

          let nByte = ny * image.bytesPerRow + nx * 4
          let nr = image.data[nByte]
          let ng = image.data[nByte + 1]
          let nb = image.data[nByte + 2]
          let na = image.data[nByte + 3]

          if isCheckerboardPixel(r: nr, g: ng, b: nb, a: na) {
            visited[nFlat] = 1
            queue.append(nFlat)
          } else {
            visited[nFlat] = 1
          }
        }
      }

      if area > bestArea {
        bestArea = area
        bestRect = CGRect(
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        )
      }
    }
  }

  return bestRect
}

func resizeImage(_ image: CGImage, to size: CGSize) -> CGImage? {
  let width = Int(size.width)
  let height = Int(size.height)

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
  context.draw(image, in: CGRect(x: 0, y: 0, width: size.width, height: size.height))
  return context.makeImage()
}

func transparentized(_ image: CGImage) -> CGImage? {
  guard var imageData = imageBytes(from: image) else {
    return nil
  }

  for y in 0..<imageData.height {
    for x in 0..<imageData.width {
      let index = y * imageData.bytesPerRow + x * 4
      let r = imageData.data[index]
      let g = imageData.data[index + 1]
      let b = imageData.data[index + 2]
      let a = imageData.data[index + 3]

      if isCheckerboardPixel(r: r, g: g, b: b, a: a) {
        imageData.data[index + 3] = 0
      }
    }
  }

  guard let provider = CGDataProvider(data: Data(imageData.data) as CFData) else {
    return nil
  }

  return CGImage(
    width: imageData.width,
    height: imageData.height,
    bitsPerComponent: 8,
    bitsPerPixel: 32,
    bytesPerRow: imageData.bytesPerRow,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
    provider: provider,
    decode: nil,
    shouldInterpolate: false,
    intent: .defaultIntent
  )
}

func opaqueComponents(in image: ImageBytes) -> [Component] {
  let width = image.width
  let height = image.height
  var visited = [UInt8](repeating: 0, count: width * height)
  var components = [Component]()

  for y in 0..<height {
    for x in 0..<width {
      let flatIndex = y * width + x
      if visited[flatIndex] == 1 {
        continue
      }

      let alphaIndex = y * image.bytesPerRow + x * 4 + 3
      if image.data[alphaIndex] == 0 {
        visited[flatIndex] = 1
        continue
      }

      var queue = [flatIndex]
      var pixels = [Int]()
      visited[flatIndex] = 1
      var minX = x
      var maxX = x
      var minY = y
      var maxY = y
      var pointer = 0

      while pointer < queue.count {
        let current = queue[pointer]
        pointer += 1
        pixels.append(current)

        let cx = current % width
        let cy = current / width
        minX = min(minX, cx)
        maxX = max(maxX, cx)
        minY = min(minY, cy)
        maxY = max(maxY, cy)

        let neighbors = [
          (cx - 1, cy),
          (cx + 1, cy),
          (cx, cy - 1),
          (cx, cy + 1)
        ]

        for (nx, ny) in neighbors {
          if nx < 0 || ny < 0 || nx >= width || ny >= height {
            continue
          }

          let nFlat = ny * width + nx
          if visited[nFlat] == 1 {
            continue
          }

          let nAlpha = ny * image.bytesPerRow + nx * 4 + 3
          if image.data[nAlpha] > 0 {
            visited[nFlat] = 1
            queue.append(nFlat)
          } else {
            visited[nFlat] = 1
          }
        }
      }

      components.append(
        Component(
          pixels: pixels,
          area: pixels.count,
          bounds: CGRect(
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
          )
        )
      )
    }
  }

  return components
}

func rectDistance(_ a: CGRect, _ b: CGRect) -> CGFloat {
  if a.intersects(b) {
    return 0
  }

  let dx: CGFloat
  if a.maxX < b.minX {
    dx = b.minX - a.maxX
  } else if b.maxX < a.minX {
    dx = a.minX - b.maxX
  } else {
    dx = 0
  }

  let dy: CGFloat
  if a.maxY < b.minY {
    dy = b.minY - a.maxY
  } else if b.maxY < a.minY {
    dy = a.minY - b.maxY
  } else {
    dy = 0
  }

  return sqrt(dx * dx + dy * dy)
}

func cleanedSpriteOnly(_ image: CGImage) -> CGImage? {
  guard var imageData = imageBytes(from: image) else {
    return nil
  }

  let components = opaqueComponents(in: imageData)
  guard let main = components.max(by: { $0.area < $1.area }) else {
    return image
  }

  var keptPixels = Set(main.pixels)
  for component in components {
    if component.area == main.area && component.bounds == main.bounds {
      continue
    }

    if component.area <= 180 && rectDistance(component.bounds, main.bounds) <= 26 {
      keptPixels.formUnion(component.pixels)
    }
  }

  for y in 0..<imageData.height {
    for x in 0..<imageData.width {
      let flatIndex = y * imageData.width + x
      if keptPixels.contains(flatIndex) {
        continue
      }

      let alphaIndex = y * imageData.bytesPerRow + x * 4 + 3
      imageData.data[alphaIndex] = 0
    }
  }

  guard let provider = CGDataProvider(data: Data(imageData.data) as CFData) else {
    return nil
  }

  return CGImage(
    width: imageData.width,
    height: imageData.height,
    bitsPerComponent: 8,
    bitsPerPixel: 32,
    bytesPerRow: imageData.bytesPerRow,
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

func savePNG(_ image: CGImage, to url: URL) throws {
  guard let data = pngData(from: image) else {
    throw NSError(domain: "sprite", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not encode PNG"])
  }
  try data.write(to: url)
}

func frameImage(from screenshotURL: URL) throws -> CGImage {
  guard let screenshot = loadCGImage(from: screenshotURL),
        let screenshotBytes = imageBytes(from: screenshot),
        let boardRect = largestCheckerboardBounds(in: screenshotBytes) else {
    throw NSError(domain: "sprite", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not find artboard in \(screenshotURL.lastPathComponent)"])
  }

  let cropRect = CGRect(
    x: Int(boardRect.origin.x),
    y: Int(boardRect.origin.y),
    width: Int(boardRect.width),
    height: Int(boardRect.height)
  )

  guard let cropped = screenshot.cropping(to: cropRect),
        let scaled = resizeImage(cropped, to: CGSize(width: 240, height: 180)),
        let transparent = transparentized(scaled),
        let cleaned = cleanedSpriteOnly(transparent) else {
    throw NSError(domain: "sprite", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not build frame from \(screenshotURL.lastPathComponent)"])
  }

  return cleaned
}

func compositeStrip(frames: [CGImage]) -> CGImage? {
  let frameWidth = 240
  let frameHeight = 180
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
    return nil
  }

  context.clear(CGRect(x: 0, y: 0, width: outputWidth, height: frameHeight))

  for (index, frame) in frames.enumerated() {
    let x = index * frameWidth
    context.draw(frame, in: CGRect(x: x, y: 0, width: frameWidth, height: frameHeight))
  }

  return context.makeImage()
}

if CommandLine.arguments.count < 8 {
  fputs("Usage: swift build_sprite_sheet.swift <output-strip> <shot1> <shot2> <shot3> <shot4> <shot5> <shot6>\n", stderr)
  exit(1)
}

let outputStripURL = URL(fileURLWithPath: CommandLine.arguments[1])
let screenshotURLs = CommandLine.arguments.dropFirst(2).map { URL(fileURLWithPath: $0) }
let framesDirectoryURL = outputStripURL.deletingLastPathComponent().appendingPathComponent("nash-run-frames", isDirectory: true)

try FileManager.default.createDirectory(
  at: framesDirectoryURL,
  withIntermediateDirectories: true,
  attributes: nil
)

var frames = [CGImage]()
for (index, url) in screenshotURLs.enumerated() {
  let frame = try frameImage(from: url)
  frames.append(frame)
  let frameURL = framesDirectoryURL.appendingPathComponent(String(format: "frame-%02d.png", index + 1))
  try savePNG(frame, to: frameURL)
}

guard let strip = compositeStrip(frames: frames) else {
  throw NSError(domain: "sprite", code: 4, userInfo: [NSLocalizedDescriptionKey: "Could not composite strip"])
}

try savePNG(strip, to: outputStripURL)
print("Saved sprite strip to \(outputStripURL.path)")
print("Saved individual frames to \(framesDirectoryURL.path)")
