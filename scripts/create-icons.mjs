/**
 * Generates build/icon.png (512x512) and build/icon.ico
 * Uses only built-in Node modules + png-to-ico (pure JS).
 */

 import { deflateSync } from 'zlib';
 import { mkdirSync, writeFileSync } from 'fs';
 import { join, dirname } from 'path';
 import { fileURLToPath } from 'url';
 import pngToIco from 'png-to-ico';
 
 const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CRC-32 (required for PNG chunks) ─────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ── PNG generator ─────────────────────────────────────────────────────────────
function createIconPNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB

  // Build pixel rows (filter byte 0 + 3 bytes per pixel)
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(size * rowLen, 0);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const px = y * rowLen + 1 + x * 3;

      if (dist <= radius) {
        // Bright blue circle – kubernetes / Lens-like feel
        const t = 1 - dist / radius; // 1 at center, 0 at edge
        raw[px]     = Math.round(30  + t * 20);   // R
        raw[px + 1] = Math.round(100 + t * 60);   // G
        raw[px + 2] = Math.round(220 + t * 35);   // B
      } else {
        // Dark navy background
        raw[px]     = 15;
        raw[px + 1] = 25;
        raw[px + 2] = 50;
      }
    }
  }

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const buildDir = join(__dirname, '..', 'build');
  mkdirSync(buildDir, { recursive: true });

  // 512×512 PNG (used by mac / linux and as source for ICO)
  const png512 = createIconPNG(512);
  writeFileSync(join(buildDir, 'icon.png'), png512);
  console.log('✓  build/icon.png  (512×512)');

  // 256×256 PNG for the ICO
  const png256 = createIconPNG(256);
  const ico = await pngToIco([png256]);
  writeFileSync(join(buildDir, 'icon.ico'), ico);
  console.log('✓  build/icon.ico  (256×256)');
}

main().catch((err) => { console.error(err); process.exit(1); });
