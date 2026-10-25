// Just enough PNG and ICO for the brand outputs: an encoder for opaque RGB
// (Apple rejects an app icon with an alpha channel, and resvg only writes
// RGBA), an ICO container of PNGs, and header readers for brand.test.ts.
import { deflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** RGBA pixels (alpha must be 255 everywhere) → an 8-bit RGB PNG, no alpha channel. */
export function encodeOpaquePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const stride = width * 3 + 1
  const rows = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (rgba[i + 3] !== 255) throw new Error(`pixel ${x},${y} is not opaque`)
      const o = y * stride + 1 + x * 3
      rows[o] = rgba[i] ?? 0
      rows[o + 1] = rgba[i + 1] ?? 0
      rows[o + 2] = rgba[i + 2] ?? 0
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour type: truecolour, no alpha
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export type PngHeader = { width: number; height: number; colorType: number }

/** Width, height and colour type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
export function readPngHeader(png: Uint8Array): PngHeader {
  const buf = Buffer.from(png)
  if (!buf.subarray(0, 8).equals(SIGNATURE) || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG')
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] ?? -1 }
}

/** PNGs → one .ico (PNG-compressed entries, Vista+; every Windows Electron supports). */
export function encodeIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size // 0 means 256
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)])
}

/** Each entry's directory size and its embedded PNG's header. */
export function readIco(ico: Uint8Array): Array<{ size: number; png: PngHeader }> {
  const buf = Buffer.from(ico)
  if (buf.readUInt16LE(2) !== 1) throw new Error('not an icon file')
  return Array.from({ length: buf.readUInt16LE(4) }, (_, i) => {
    const at = 6 + 16 * i
    const size = buf[at] || 256
    const length = buf.readUInt32LE(at + 8)
    const offset = buf.readUInt32LE(at + 12)
    return { size, png: readPngHeader(buf.subarray(offset, offset + length)) }
  })
}
