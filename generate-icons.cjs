/**
 * Generates PWA icon PNG files for HUE Room.
 * Creates: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
 * Uses only Node.js built-ins (zlib, fs, path) — no external dependencies.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32 table
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = Buffer.allocUnsafe(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcVal]);
}

function buildPNG(size, pixelsFn) {
  // IHDR
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Raw scanlines: filter byte (0) + RGB per row
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelsFn(x, y, size);
      const i = y * (1 + size * 3) + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Pixel function: amber circle on dark slate background.
 * - Background: #0f172a (slate-950)
 * - Circle fill: amber-to-orange gradient
 * - White lightbulb hint in center
 */
function iconPixel(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = size * 0.45;

  // Background
  if (dist >= radius) return [15, 23, 42]; // slate-950

  // Radial amber→orange gradient inside circle
  const t = dist / radius; // 0=center, 1=edge
  // amber-400: #fbbf24 = rgb(251,191,36)
  // orange-500: #f97316 = rgb(249,115,22)
  const r = Math.round(251 + t * (249 - 251));
  const g = Math.round(191 + t * (115 - 191));
  const b = Math.round(36 + t * (22 - 36));

  // White lightbulb glow in center (upper half of circle)
  const bulbR = radius * 0.32;
  if (dist < bulbR && dy < 0) {
    const glow = 1 - dist / bulbR;
    return [
      Math.round(r + glow * (255 - r)),
      Math.round(g + glow * (255 - g)),
      Math.round(b + glow * (255 - b)),
    ];
  }

  // Lightbulb base/collar (small rectangle below bulb center)
  const baseWidth = radius * 0.18;
  const baseTop = cy * 0.08;
  const baseBot = cy * 0.22;
  if (Math.abs(dx) < baseWidth && dy >= baseTop && dy < baseBot) {
    return [255, 255, 255];
  }

  return [r, g, b];
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const icons = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of icons) {
  const png = buildPNG(size, iconPixel);
  fs.writeFileSync(path.join(publicDir, file), png);
  console.log(`✓ public/${file} (${size}x${size}, ${png.length} bytes)`);
}
