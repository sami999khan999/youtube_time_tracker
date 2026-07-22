/**
 * Icon generator for YouTube Time Tracker.
 *
 * Draws a clean "play-in-clock" mark on a rounded, red gradient tile and
 * writes real PNGs (16 / 48 / 128) into ../icons using only Node built-ins
 * (no image libraries). Rendered at 4x supersampling then box-downsampled
 * for anti-aliasing.
 *
 * Usage: node tools/generate-icons.js
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---- PNG encoding (RGBA, 8-bit) -------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Drawing --------------------------------------------------------------
const TOP = [255, 45, 85]; // gradient top (bright red)
const BOTTOM = [193, 18, 60]; // gradient bottom (deep brand red)
const WHITE = [255, 255, 255];

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Rounded-rect coverage: 1 inside, 0 outside (hard edge; supersampling softens).
function insideRoundedRect(u, v, r) {
  // u,v in [0,1]; r = corner radius in same units
  const dx = Math.max(r - u, u - (1 - r), 0);
  const dy = Math.max(r - v, v - (1 - r), 0);
  return Math.sqrt(dx * dx + dy * dy) <= r ? 1 : 0;
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// Returns [r,g,b,a] for a normalized point (u,v) in [0,1].
function sample(u, v) {
  const cornerR = 0.22;
  if (!insideRoundedRect(u, v, cornerR)) return [0, 0, 0, 0];

  // Background gradient (top -> bottom)
  let col = lerp(TOP, BOTTOM, v);

  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.hypot(u - cx, v - cy);

  // Clock ring
  const ringOuter = 0.365;
  const ringInner = 0.285;
  if (dist <= ringOuter && dist >= ringInner) {
    col = WHITE;
  }

  // 12 o'clock tick (small notch for the "clock" read)
  const tickHalfW = 0.028;
  if (
    Math.abs(u - cx) <= tickHalfW &&
    v >= cy - ringInner - 0.015 &&
    v <= cy - ringInner + 0.055
  ) {
    col = WHITE;
  }

  // Play triangle (nudged right a touch for optical centering)
  const s = 0.017; // optical shift
  if (
    insideTriangle(
      u,
      v,
      0.435 + s,
      0.37,
      0.435 + s,
      0.63,
      0.645 + s,
      0.5,
    )
  ) {
    col = WHITE;
  }

  return [col[0], col[1], col[2], 255];
}

function render(size) {
  const ss = 4;
  const S = size * ss;
  const hi = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, g, b, a] = sample((x + 0.5) / S, (y + 0.5) / S);
      const i = (y * S + x) * 4;
      hi[i] = r;
      hi[i + 1] = g;
      hi[i + 2] = b;
      hi[i + 3] = a;
    }
  }
  // Box downsample ss x ss -> premultiplied average for clean edges
  const out = Buffer.alloc(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((oy * ss + sy) * S + (ox * ss + sx)) * 4;
          const af = hi[i + 3] / 255;
          r += hi[i] * af;
          g += hi[i + 1] * af;
          b += hi[i + 2] * af;
          a += hi[i + 3];
        }
      }
      const n = ss * ss;
      const alpha = a / n;
      const o = (oy * size + ox) * 4;
      if (alpha > 0) {
        const aw = a / 255; // sum of alpha fractions
        out[o] = Math.round(r / aw);
        out[o + 1] = Math.round(g / aw);
        out[o + 2] = Math.round(b / aw);
      }
      out[o + 3] = Math.round(alpha);
    }
  }
  return out;
}

const OUT_DIR = path.join(__dirname, "..", "icons");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

[16, 48, 128].forEach((size) => {
  const rgba = render(size);
  const png = encodePNG(size, size, rgba);
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✅ icons/icon${size}.png (${(png.length / 1024).toFixed(1)} KB)`);
});
