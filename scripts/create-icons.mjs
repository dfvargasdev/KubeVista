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
  const rowLen = 1 + size * 4; // RGBA
  ihdr[9] = 6; // RGBA color type
  const raw = Buffer.alloc(size * rowLen, 0);

  const cx = size / 2;
  const cy = size / 2;

  // Helper: distance point-to-segment for line drawing
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Node positions: center hub + 6 outer nodes (hexagonal)
  const hubR   = size * 0.115;
  const nodeR  = size * 0.072;
  const orbitR = size * 0.30;
  const lineW  = size * 0.022;
  const outerBg = size * 0.46; // rounded square clip radius

  const nodes = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    return { x: cx + Math.cos(angle) * orbitR, y: cy + Math.sin(angle) * orbitR };
  });

  // Color palette
  const BG_R = 13, BG_G = 17, BG_B = 35;         // very dark navy
  const ACCENT_R = 56, ACCENT_G = 189, ACCENT_B = 248; // sky blue
  const HUB_R = 99, HUB_G = 102, HUB_B = 241;     // indigo hub
  const LINE_R = 56, LINE_G = 189, LINE_B = 248;   // same as accent

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const px = y * rowLen + 1 + x * 4;

      // Rounded square background clip (outer alpha)
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const corner = size * 0.18;
      let inBg = false;
      if (dx <= outerBg && dy <= outerBg) {
        if (dx <= outerBg - corner || dy <= outerBg - corner ||
            Math.hypot(dx - (outerBg - corner), dy - (outerBg - corner)) <= corner) {
          inBg = true;
        }
      }
      if (!inBg) { raw[px + 3] = 0; continue; } // transparent

      // Default: background
      raw[px]     = BG_R;
      raw[px + 1] = BG_G;
      raw[px + 2] = BG_B;
      raw[px + 3] = 255;

      // Draw connector lines (hub → each node)
      for (const node of nodes) {
        const d = distToSegment(x, y, cx, cy, node.x, node.y);
        if (d < lineW) {
          const alpha = Math.max(0, 1 - d / lineW);
          raw[px]     = Math.round(LINE_R * alpha + BG_R * (1 - alpha));
          raw[px + 1] = Math.round(LINE_G * alpha + BG_G * (1 - alpha));
          raw[px + 2] = Math.round(LINE_B * alpha + BG_B * (1 - alpha));
        }
      }

      // Draw outer nodes
      for (const node of nodes) {
        const d = Math.hypot(x - node.x, y - node.y);
        if (d <= nodeR) {
          const t = 1 - d / nodeR;
          const glow = t * 0.4;
          raw[px]     = Math.round(Math.min(255, ACCENT_R + glow * 120));
          raw[px + 1] = Math.round(Math.min(255, ACCENT_G + glow * 40));
          raw[px + 2] = Math.round(Math.min(255, ACCENT_B + glow * 5));
        }
      }

      // Draw center hub (indigo gradient circle)
      const distHub = Math.hypot(x - cx, y - cy);
      if (distHub <= hubR) {
        const t = 1 - distHub / hubR;
        raw[px]     = Math.round(HUB_R + t * 40);
        raw[px + 1] = Math.round(HUB_G + t * 20);
        raw[px + 2] = Math.round(HUB_B + t * 14);
      }

      // Subtle glow around hub
      if (distHub > hubR && distHub <= hubR * 1.6) {
        const fade = 1 - (distHub - hubR) / (hubR * 0.6);
        raw[px]     = Math.round(raw[px]     * (1 - fade * 0.3) + HUB_R * fade * 0.3);
        raw[px + 1] = Math.round(raw[px + 1] * (1 - fade * 0.3) + HUB_G * fade * 0.3);
        raw[px + 2] = Math.round(raw[px + 2] * (1 - fade * 0.3) + HUB_B * fade * 0.3);
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
