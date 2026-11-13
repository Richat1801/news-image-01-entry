// "The World on Friday 13 November 2026" — news-image-01 entry.
// A fully procedural editorial infographic, drawn fresh in this session.
// Six panels, each one verified 13 Nov 2026 story (Reuters / BBC / Al Jazeera):
//   1. US Senate summons ex-Nvidia CEO Huang & Commerce Secretary Lutnick
//   2. Zelensky meets US envoys; Europe to join the next peace talks
//   3. Ukrainian drone hits a Russian warship in the Gulf of Finland
//   4. Iran: LNG tanker hit by a mine in the Strait of Hormuz
//   5. Microsoft 365 global outage hits millions (Outlook / Teams down)
//   6. FBI: North Korean hackers' $400m crypto theft via fake video calls
// Footer strip: Kane's record 126th cap, record US deportations, Delhi smog.
// Node 22, stdlib only, no network, deterministic (two runs byte-identical).
// Own PNG encoder (node:zlib + runtime CRC32 table), float framebuffer.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- framebuffer
const fb = new Float32Array(W * H * 3);

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
function px(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb[i] = r; fb[i + 1] = g; fb[i + 2] = b;
}
function fillRect(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(W - 1, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(H - 1, Math.ceil(y1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) px(x, y, c[0], c[1], c[2]);
}
function disc(cx: number, cy: number, r: number, c: number[]): void {
  const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(W - 1, Math.ceil(cx + r));
  const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r * r) px(x, y, c[0], c[1], c[2]);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
  const xa = Math.max(0, Math.floor(cx - rx)), xb = Math.min(W - 1, Math.ceil(cx + rx));
  const ya = Math.max(0, Math.floor(cy - ry)), yb = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1) px(x, y, c[0], c[1], c[2]);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]): void {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1, x2))), xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1, y2))), yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
    const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
    const g2 = 1 - a - b;
    if (a >= 0 && b >= 0 && g2 >= 0) px(x, y, c[0], c[1], c[2]);
  }
}
// Thick line segment (drawn as a row of discs along the segment).
function line(x0: number, y0: number, x1: number, y1: number, w: number, c: number[]): void {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + dx * t, y0 + dy * t, w / 2, c);
  }
}
function ring(cx: number, cy: number, r: number, w: number, c: number[]): void {
  const xa = Math.max(0, Math.floor(cx - r - w)), xb = Math.min(W - 1, Math.ceil(cx + r + w));
  const ya = Math.max(0, Math.floor(cy - r - w)), yb = Math.min(H - 1, Math.ceil(cy + r + w));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (Math.abs(d - r) <= w / 2) px(x, y, c[0], c[1], c[2]);
  }
}
// Rounded rectangle (corner radius r).
function rrect(x0: number, y0: number, x1: number, y1: number, r: number, c: number[]): void {
  fillRect(x0 + r, y0, x1 - r, y1, c);
  fillRect(x0, y0 + r, x1, y1 - r, c);
  disc(x0 + r, y0 + r, r, c); disc(x1 - r, y0 + r, r, c);
  disc(x0 + r, y1 - r, r, c); disc(x1 - r, y1 - r, r, c);
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, MSB first. Covers A-Z, 0-9 and the punctuation
// the labels need: space & : . , ' - / ( ) $ % !
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '&': [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  ':': [0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0x00, 0x00, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x0e, 0x00, 0x00, 0x00],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '%': [0x19, 0x1a, 0x02, 0x04, 0x08, 0x0b, 0x13],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: number[]): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (1 << (4 - col))) {
          fillRect(cx + col * scale, y + row * scale, cx + (col + 1) * scale - 1, y + (row + 1) * scale - 1, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: number[]): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 3;
      const di = y * (1 + W * 3) + 1 + x * 3;
      raw[di] = clamp255(Math.round(fb[si]));
      raw[di + 1] = clamp255(Math.round(fb[si + 1]));
      raw[di + 2] = clamp255(Math.round(fb[si + 2]));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- palette
const NAVY = [27, 42, 74];
const NAVY2 = [36, 56, 96];
const GOLD = [201, 162, 75];
const PAPER = [248, 244, 236];
const INK = [27, 42, 74];
const WHITE = [255, 255, 255];
const SKIN = [232, 190, 150];
const SUIT = [52, 64, 84];

// Panel frame: paper card, accent top bar, thin navy border.
function panel(x: number, y: number, accent: number[]): void {
  fillRect(x, y, x + 319, y + 399, PAPER);
  fillRect(x, y, x + 319, y + 9, accent);
  // border
  fillRect(x, y, x + 319, y + 2, NAVY);
  fillRect(x, y + 397, x + 319, y + 399, NAVY);
  fillRect(x, y, x + 2, y + 399, NAVY);
  fillRect(x + 317, y, x + 319, y + 399, NAVY);
}
// Two label lines at the foot of a panel.
function panelLabels(x: number, y: number, l1: string, l2: string): void {
  drawTextCentered(l1, x + 160, y + 312, 3, INK);
  drawTextCentered(l2, x + 160, y + 344, 3, INK);
}

// Small US flag (w x h), stripes + canton + star dots.
function usFlag(x: number, y: number, w: number, h: number): void {
  const stripe = h / 13;
  for (let i = 0; i < 13; i++) {
    fillRect(x, y + i * stripe, x + w, y + (i + 1) * stripe - 1, i % 2 === 0 ? [178, 34, 52] : WHITE);
  }
  fillRect(x, y, x + w * 0.4, y + stripe * 7, [60, 59, 110]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    disc(x + 4 + c * (w * 0.4 - 8) / 4, y + 4 + r * (stripe * 7 - 8) / 3, 1.5, WHITE);
  }
}

// ------------------------------------------------------- 1. Senate summons
function sceneSenate(x: number, y: number): void {
  // Hearing-room wall, wood panelling.
  fillRect(x, y, x + 319, y + 299, [222, 205, 172]);
  fillRect(x, y + 150, x + 319, y + 299, [150, 108, 66]);
  // US flag on a pole, left.
  line(x + 52, y + 30, x + 52, y + 175, 4, [90, 70, 40]);
  disc(x + 52, y + 28, 5, GOLD);
  usFlag(x + 56, y + 32, 86, 52);
  // Witness desk.
  fillRect(x + 30, y + 205, x + 289, y + 299, [122, 84, 48]);
  fillRect(x + 30, y + 205, x + 289, y + 216, [96, 64, 36]);
  // Two empty witness chairs behind the desk.
  for (const cx of [x + 105, x + 215]) {
    rrect(cx - 34, y + 118, cx + 34, y + 208, 8, [44, 52, 70]);
    fillRect(cx - 34, y + 150, cx + 34, y + 165, [30, 38, 52]);
    fillRect(cx - 4, y + 208, cx + 4, y + 228, [30, 38, 52]);
  }
  // A black leather jacket draped over the left chair.
  rrect(x + 72, y + 112, x + 138, y + 150, 10, [96, 64, 36]);
  fillRect(x + 72, y + 140, x + 138, y + 178, [96, 64, 36]);
  line(x + 105, y + 112, x + 105, y + 150, 3, [70, 46, 26]);
  // Microphones on the desk.
  for (const mx of [x + 105, x + 215]) {
    line(mx, y + 205, mx, y + 178, 3, [40, 40, 40]);
    disc(mx, y + 176, 6, [40, 40, 40]);
  }
  // A green AI chip on the desk between the chairs.
  fillRect(x + 148, y + 222, x + 172, y + 246, [34, 120, 70]);
  for (let i = 0; i < 3; i++) {
    line(x + 144, y + 226 + i * 8, x + 148, y + 226 + i * 8, 2, GOLD);
    line(x + 172, y + 226 + i * 8, x + 176, y + 226 + i * 8, 2, GOLD);
  }
  // Nameplate.
  fillRect(x + 128, y + 258, x + 192, y + 276, [240, 230, 200]);
  drawTextCentered('SENATE', x + 160, y + 262, 1, INK);
}

// ------------------------------------------------- 2. Zelensky meets envoys
function sceneZelensky(x: number, y: number): void {
  fillRect(x, y, x + 319, y + 299, [206, 220, 232]);
  // Three flags on poles behind the table: Ukraine, US, EU.
  const flags: [number, number][] = [[x + 55, 0], [x + 160, 1], [x + 265, 2]];
  for (const [fx, kind] of flags) {
    line(fx, y + 28, fx, y + 165, 4, [90, 70, 40]);
    disc(fx, y + 26, 5, GOLD);
    if (kind === 0) {
      fillRect(fx + 4, y + 30, fx + 52, y + 56, [0, 87, 184]);
      fillRect(fx + 4, y + 56, fx + 52, y + 82, [255, 215, 0]);
    } else if (kind === 1) {
      usFlag(fx + 4, y + 30, 48, 52);
    } else {
      fillRect(fx + 4, y + 30, fx + 52, y + 82, [0, 51, 153]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        disc(fx + 28 + Math.cos(a) * 16, y + 56 + Math.sin(a) * 16, 2.5, [255, 215, 0]);
      }
    }
  }
  // Two seated figures, suits and heads.
  for (const [fx, skin] of [[x + 105, SKIN], [x + 215, SKIN]] as [number, number[]][]) {
    rrect(fx - 32, y + 170, fx + 32, y + 250, 12, SUIT);
    disc(fx, y + 142, 26, skin);
    // hair
    disc(fx, y + 128, 24, [60, 48, 36]);
    disc(fx, y + 140, 22, skin);
    fillRect(fx - 4, y + 168, fx + 4, y + 200, [240, 240, 240]);
    tri(fx - 8, y + 168, fx + 8, y + 168, fx, y + 186, [178, 34, 52]);
  }
  // The handshake over the table.
  disc(x + 148, y + 196, 12, SKIN);
  disc(x + 172, y + 196, 12, SKIN);
  line(x + 136, y + 188, x + 184, y + 204, 10, SKIN);
  line(x + 136, y + 204, x + 184, y + 188, 10, SKIN);
  // Round table.
  ellipse(x + 160, y + 262, 130, 34, [122, 84, 48]);
  fillRect(x + 30, y + 262, x + 290, y + 272, [96, 64, 36]);
  fillRect(x + 150, y + 272, x + 170, y + 299, [96, 64, 36]);
  // Papers on the table.
  fillRect(x + 70, y + 246, x + 110, y + 258, WHITE);
  fillRect(x + 210, y + 246, x + 250, y + 258, WHITE);
}

// -------------------------------------------- 3. Drone hits Russian warship
function sceneWarship(x: number, y: number): void {
  // Cold northern sky and sea.
  fillRect(x, y, x + 319, y + 150, [198, 210, 216]);
  ellipse(x + 72, y + 55, 30, 12, [228, 232, 234]);
  ellipse(x + 250, y + 40, 26, 11, [228, 232, 234]);
  fillRect(x, y + 150, x + 319, y + 299, [96, 128, 148]);
  fillRect(x, y + 150, x + 319, y + 168, [120, 152, 172]);
  // Wave lines.
  for (let i = 0; i < 5; i++) {
    line(x + 20 + i * 60, y + 200 + (i % 2) * 30, x + 60 + i * 60, y + 200 + (i % 2) * 30, 3, [200, 220, 230]);
  }
  // Warship: dark grey hull with a pointed bow, superstructure, mast, funnel.
  fillRect(x + 45, y + 210, x + 258, y + 246, [58, 66, 74]);
  tri(x + 258, y + 210, x + 285, y + 228, x + 258, y + 246, [58, 66, 74]);
  fillRect(x + 45, y + 210, x + 285, y + 216, [74, 82, 90]); // deck line
  fillRect(x + 110, y + 172, x + 200, y + 210, [74, 82, 90]);
  fillRect(x + 205, y + 158, x + 222, y + 210, [74, 82, 90]);
  line(x + 150, y + 172, x + 150, y + 128, 5, [58, 66, 74]);
  disc(x + 150, y + 126, 5, [58, 66, 74]);
  // Portholes.
  for (let i = 0; i < 6; i++) disc(x + 70 + i * 36, y + 228, 4, [200, 210, 215]);
  // Smoke plume from the hit, orange fire sitting on the deck at the bow.
  disc(x + 252, y + 196, 18, [232, 120, 40]);
  disc(x + 252, y + 196, 11, [245, 180, 60]);
  disc(x + 240, y + 158, 24, [40, 40, 44]);
  disc(x + 254, y + 126, 20, [60, 60, 64]);
  disc(x + 264, y + 96, 15, [80, 80, 84]);
  // White foam where the bow cuts the sea.
  line(x + 278, y + 246, x + 292, y + 232, 4, WHITE);
  line(x + 282, y + 248, x + 296, y + 240, 4, WHITE);
  // The drone above, quadcopter.
  fillRect(x + 128, y + 78, x + 152, y + 92, [30, 30, 34]);
  disc(x + 140, y + 85, 5, [200, 40, 40]);
  line(x + 118, y + 76, x + 162, y + 76, 3, [30, 30, 34]);
  line(x + 118, y + 94, x + 162, y + 94, 3, [30, 30, 34]);
  line(x + 112, y + 70, x + 132, y + 70, 3, [120, 120, 120]);
  line(x + 148, y + 70, x + 168, y + 70, 3, [120, 120, 120]);
}

// ------------------------------------------ 4. Iran: tanker hit in Hormuz
function sceneTanker(x: number, y: number): void {
  // Dusk sky over the strait.
  fillRect(x, y, x + 319, y + 140, [232, 196, 150]);
  disc(x + 262, y + 52, 26, [245, 200, 110]);
  fillRect(x, y + 140, x + 319, y + 299, [46, 95, 122]);
  fillRect(x, y + 140, x + 319, y + 156, [70, 122, 148]);
  for (let i = 0; i < 5; i++) {
    line(x + 15 + i * 62, y + 220 + (i % 2) * 34, x + 55 + i * 62, y + 220 + (i % 2) * 34, 3, [150, 190, 205]);
  }
  // The tanker: long dark-red hull, deck, white bridge tower.
  fillRect(x + 35, y + 196, x + 285, y + 238, [122, 34, 30]);
  fillRect(x + 35, y + 196, x + 285, y + 206, [90, 26, 24]);
  fillRect(x + 40, y + 168, x + 80, y + 196, [240, 240, 240]);
  fillRect(x + 48, y + 176, x + 72, y + 184, [60, 90, 110]);
  fillRect(x + 96, y + 182, x + 140, y + 196, [70, 70, 74]);
  fillRect(x + 160, y + 186, x + 196, y + 196, [70, 70, 74]);
  // Cargo hatches.
  for (let i = 0; i < 4; i++) fillRect(x + 210 + i * 16, y + 206, x + 222 + i * 16, y + 214, [150, 60, 50]);
  // Explosion burst above midship: overlapping fireball discs + black smoke.
  disc(x + 148, y + 138, 26, [200, 60, 30]);
  disc(x + 168, y + 126, 26, [232, 120, 40]);
  disc(x + 160, y + 132, 16, [245, 180, 60]);
  disc(x + 160, y + 132, 8, [250, 220, 120]);
  disc(x + 118, y + 96, 18, [40, 40, 44]);
  disc(x + 196, y + 92, 16, [40, 40, 44]);
  disc(x + 160, y + 78, 14, [60, 60, 64]);
  // A spiky naval mine in the foreground water.
  disc(x + 262, y + 268, 14, [30, 30, 34]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(x + 262 + Math.cos(a) * 12, y + 268 + Math.sin(a) * 12, x + 262 + Math.cos(a) * 20, y + 268 + Math.sin(a) * 20, 3, [30, 30, 34]);
  }
  disc(x + 262, y + 268, 5, [90, 90, 94]);
}

// ------------------------------------------------- 5. Microsoft 365 outage
function sceneOutage(x: number, y: number): void {
  fillRect(x, y, x + 319, y + 299, [232, 238, 244]);
  // Faint globe behind: the outage was worldwide.
  ring(x + 160, y + 120, 92, 3, [180, 196, 208]);
  ellipse(x + 160, y + 120, 92, 34, [180, 196, 208]);
  line(x + 160, y + 28, x + 160, y + 212, 3, [180, 196, 208]);
  // The laptop: dark bezel, blue screen, envelope with a red X.
  rrect(x + 62, y + 96, x + 258, y + 250, 8, [36, 40, 46]);
  fillRect(x + 74, y + 108, x + 246, y + 238, [31, 78, 121]);
  // Envelope.
  fillRect(x + 118, y + 140, x + 202, y + 196, WHITE);
  line(x + 118, y + 140, x + 160, y + 172, 4, [180, 190, 200]);
  line(x + 202, y + 140, x + 160, y + 172, 4, [180, 190, 200]);
  // Big red X over the envelope.
  line(x + 112, y + 134, x + 208, y + 202, 12, [200, 40, 40]);
  line(x + 208, y + 134, x + 112, y + 202, 12, [200, 40, 40]);
  // Laptop base.
  tri(x + 62, y + 250, x + 258, y + 250, x + 268, y + 264, [52, 56, 62]);
  fillRect(x + 52, y + 250, x + 268, y + 264, [52, 56, 62]);
  // A phone beside it, also down.
  rrect(x + 268, y + 176, x + 300, y + 250, 6, [36, 40, 46]);
  fillRect(x + 272, y + 182, x + 296, y + 244, [31, 78, 121]);
  line(x + 276, y + 188, x + 292, y + 238, 6, [200, 40, 40]);
  line(x + 292, y + 188, x + 276, y + 238, 6, [200, 40, 40]);
  // Small app tiles, each crossed out.
  const tiles: [number, number, number[]][] = [
    [x + 24, y + 110, [0, 120, 215]],
    [x + 24, y + 160, [80, 160, 90]],
    [x + 24, y + 210, [150, 90, 170]],
  ];
  for (const [tx, ty, tc] of tiles) {
    fillRect(tx, ty, tx + 30, ty + 30, tc);
    line(tx + 4, ty + 4, tx + 26, ty + 26, 4, [200, 40, 40]);
    line(tx + 26, ty + 4, tx + 4, ty + 26, 4, [200, 40, 40]);
  }
}

// --------------------------------------- 6. FBI: N. Korea $400m crypto hack
function sceneHack(x: number, y: number): void {
  fillRect(x, y, x + 319, y + 299, [35, 39, 46]);
  // Laptop with a fake video call on screen.
  rrect(x + 52, y + 60, x + 268, y + 236, 8, [20, 22, 26]);
  fillRect(x + 62, y + 70, x + 258, y + 226, [46, 54, 66]);
  // Video-call window: masked face.
  fillRect(x + 112, y + 82, x + 208, y + 178, [24, 28, 34]);
  disc(x + 160, y + 130, 30, [18, 18, 20]); // balaclava
  disc(x + 160, y + 138, 20, [232, 190, 150]); // face opening
  fillRect(x + 146, y + 122, x + 174, y + 130, [18, 18, 20]); // mask band
  disc(x + 152, y + 134, 4, [20, 20, 24]); // eyes
  disc(x + 168, y + 134, 4, [20, 20, 24]);
  line(x + 152, y + 152, x + 168, y + 152, 3, [120, 60, 50]); // mouth
  // Call controls.
  disc(x + 140, y + 196, 9, [200, 40, 40]);
  disc(x + 160, y + 196, 9, [80, 160, 90]);
  disc(x + 180, y + 196, 9, [120, 120, 130]);
  // Gold coins spilling out of the screen.
  const coins: [number, number, number][] = [
    [x + 80, y + 246, 14], [x + 120, y + 258, 12], [x + 165, y + 250, 15],
    [x + 210, y + 262, 12], [x + 248, y + 250, 14], [x + 92, y + 276, 11],
    [x + 190, y + 280, 11], [x + 236, y + 280, 10],
  ];
  for (const [cx, cy, r] of coins) {
    disc(cx, cy, r, [212, 175, 55]);
    ring(cx, cy, r - 4, 2, [160, 125, 30]);
    drawText('$', cx - 3, cy - 4, 1, [120, 90, 20]);
  }
  // Red warning triangle, top right.
  tri(x + 272, y + 74, x + 292, y + 108, x + 252, y + 108, [200, 40, 40]);
  drawText('!', x + 268, y + 84, 2, WHITE);
}

// ------------------------------------------------------------------- layout
function main(): void {
  fillRect(0, 0, W - 1, H - 1, PAPER);

  // Header band.
  fillRect(0, 0, W - 1, 103, NAVY);
  fillRect(0, 100, W - 1, 103, GOLD);
  drawTextCentered('FRIDAY 13 NOVEMBER 2026', W / 2, 16, 4, WHITE);
  drawTextCentered('THE WORLD TODAY', W / 2, 62, 2, GOLD);

  // Six panels, 3 x 2.
  const cols = [16, 352, 688];
  const rows = [120, 536];
  const accents = [[138, 109, 59], [47, 111, 178], [90, 107, 122], [179, 84, 30], [0, 120, 212], [192, 57, 43]];
  const scenes = [sceneSenate, sceneZelensky, sceneWarship, sceneTanker, sceneOutage, sceneHack];
  const labels: [string, string][] = [
    ['SENATE SUMMONS', 'HUANG & LUTNICK'],
    ['ZELENSKY MEETS', 'US ENVOYS'],
    ['DRONE HITS', 'RUSSIAN WARSHIP'],
    ['IRAN: TANKER HIT', 'IN HORMUZ'],
    ['MICROSOFT OUTAGE', 'HITS MILLIONS'],
    ['FBI: N. KOREA', '$400M CRYPTO HACK'],
  ];
  let i = 0;
  for (const ry of rows) {
    for (const cx of cols) {
      panel(cx, ry, accents[i]);
      scenes[i](cx, ry + 10);
      panelLabels(cx, ry, labels[i][0], labels[i][1]);
      i++;
    }
  }

  // Footer strip: the rest of the day in one line.
  fillRect(0, 952, W - 1, H - 1, NAVY);
  fillRect(0, 952, W - 1, 955, GOLD);
  drawTextCentered('ALSO: KANE 126TH CAP - US RECORD DEPORTATIONS - DELHI SMOG WORST IN WORLD', W / 2, 972, 2, WHITE);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePNG());
}

main();
