import AppKit
import CoreGraphics
import Foundation

struct ImageBytes {
  let width: Int
  let height: Int
  let bytesPerRow: Int
  let data: [UInt8]
}

struct Component {
  let pixels: [Int]
  let area: Int
  let bounds: CGRect
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

          visited[nFlat] = 1
          let alpha = image.data[ny * image.bytesPerRow + nx * 4 + 3]
          if alpha > 0 {
            queue.append(nFlat)
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

func unionRect(_ a: CGRect, _ b: CGRect) -> CGRect {
  CGRect(
    x: min(a.minX, b.minX),
    y: min(a.minY, b.minY),
    width: max(a.maxX, b.maxX) - min(a.minX, b.minX),
    height: max(a.maxY, b.maxY) - min(a.minY, b.minY)
  )
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
  let imageWidth = CGFloat(image.width)
  let imageHeight = CGFloat(image.height)
  let scale = min(CGFloat(width) / imageWidth, CGFloat(height) / imageHeight)
  let drawWidth = imageWidth * scale
  let drawHeight = imageHeight * scale
  let drawX = (CGFloat(width) - drawWidth) / 2
  let drawY = CGFloat(height) - drawHeight
  context.draw(image, in: CGRect(x: drawX, y: drawY, width: drawWidth, height: drawHeight))
  return context.makeImage()
}

func pngData(from image: CGImage) -> Data? {
  let rep = NSBitmapImageRep(cgImage: image)
  return rep.representation(using: .png, properties: [:])
}

if CommandLine.arguments.count < 6 {
  fputs("Usage: swift extract_components_to_strip.swift <output.png> <frame-width> <frame-height> <frame-count> <source.png>\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let frameWidth = Int(CommandLine.arguments[2]) ?? 96
let frameHeight = Int(CommandLine.arguments[3]) ?? 128
let frameCount = Int(CommandLine.arguments[4]) ?? 4
let sourceURL = URL(fileURLWithPath: CommandLine.arguments[5])

guard let sourceImage = loadImage(at: sourceURL),
      let bytes = imageBytes(from: sourceImage) else {
  fputs("Could not load source image\n", stderr)
  exit(1)
}

let allComponents = opaqueComponents(in: bytes)
let mainComponents = allComponents
  .sorted { lhs, rhs in lhs.area > rhs.area }
  .prefix(frameCount)
  .sorted { lhs, rhs in lhs.bounds.minX < rhs.bounds.minX }

let extraComponents = allComponents.filter { component in
  !mainComponents.contains(where: { $0.bounds == component.bounds && $0.area == component.area })
}

let framesDirectoryURL = outputURL.deletingLastPathComponent().appendingPathComponent(outputURL.deletingPathExtension().lastPathComponent + "-frames", isDirectory: true)
try FileManager.default.createDirectory(at: framesDirectoryURL, withIntermediateDirectories: true, attributes: nil)

var frameImages = [CGImage]()

for (index, mainComponent) in mainComponents.enumerated() {
  var groupBounds = mainComponent.bounds

  for component in extraComponents {
    let closeWithinBodyWidth =
      component.bounds.minX >= mainComponent.bounds.minX - 12 &&
      component.bounds.maxX <= mainComponent.bounds.maxX + 12 &&
      rectDistance(component.bounds, mainComponent.bounds) <= 24

    let landingDust =
      component.area <= 320 &&
      component.bounds.minY >= mainComponent.bounds.maxY - 26 &&
      rectDistance(component.bounds, mainComponent.bounds) <= 42

    if closeWithinBodyWidth || landingDust {
      groupBounds = unionRect(groupBounds, component.bounds)
    }
  }

  let paddedBounds = groupBounds.insetBy(dx: -18, dy: -18)

  guard let cropped = cropImage(sourceImage, to: paddedBounds),
        let resized = resizeImage(cropped, width: frameWidth, height: frameHeight),
        let data = pngData(from: resized) else {
    fputs("Could not build frame \(index + 1)\n", stderr)
    exit(1)
  }

  let frameURL = framesDirectoryURL.appendingPathComponent(String(format: "frame-%02d.png", index + 1))
  try data.write(to: frameURL)
  frameImages.append(resized)
}

let outputWidth = frameWidth * frameImages.count
guard let context = CGContext(
  data: nil,
  width: outputWidth,
  height: frameHeight,
  bitsPerComponent: 8,
  bytesPerRow: outputWidth * 4,
  space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
  fputs("Could not create output canvas\n", stderr)
  exit(1)
}

context.interpolationQuality = .none
context.clear(CGRect(x: 0, y: 0, width: outputWidth, height: frameHeight))

for (index, frameImage) in frameImages.enumerated() {
  let x = index * frameWidth
  context.draw(frameImage, in: CGRect(x: x, y: 0, width: frameWidth, height: frameHeight))
}

guard let outputImage = context.makeImage(),
      let outputData = pngData(from: outputImage) else {
  fputs("Could not encode output strip\n", stderr)
  exit(1)
}

try outputData.write(to: outputURL)
print("Saved strip to \(outputURL.path)")
print("Saved frames to \(framesDirectoryURL.path)")
