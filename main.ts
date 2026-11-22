// news-image-20261122 v2 — "The World in One Day, Revised"
// Sums up Sunday 22 November 2026: COP31's final text goes to a vote in
// Antalya, a missile hits Kryvyi Rih, the EU signs its Indonesia deal,
// France marches a sixth weekend, a Nigeria boat toll rises, IG Metall
// calls a Monday strike, and two Riemann claims land in one day.
// Drawn procedurally, Node standard library only: a tiny RGB canvas, a
// hand-written 5x7 bitmap font, and a minimal PNG encoder (zlib + CRC32).
// No network, no randomness, no clock: two runs are byte-identical.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ------------------------------------------------------------------ palette
type RGB = [number, number, number];
const NAVY: RGB = [14, 27, 46];
const CREAM: RGB = [245, 239, 224];
const INK: RGB = [14, 27, 46];
const AMBER: RGB = [232, 163, 61];
const RED: RGB = [176, 58, 46];
const TEAL: RGB = [31, 122, 107];
const GREY: RGB = [154, 165, 177];

// ------------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

// Bresenham line, one pixel wide.
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

// A line with a round brush of diameter w.
function thickLine(
  x0: number, y0: number, x1: number, y1: number, w: number, c: RGB,
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const r = Math.floor(w / 2);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r) setPixel(x + dx, y + dy, c);
      }
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, w: number, c: RGB): void {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(rad));
    const y = Math.round(cy + r * Math.sin(rad));
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) setPixel(x + dx, y + dy, c);
    }
  }
}

function ellipseOutline(
  cx: number, cy: number, rx: number, ry: number, w: number, c: RGB,
): void {
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + rx * Math.cos(rad));
    const y = Math.round(cy + ry * Math.sin(rad));
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) setPixel(x + dx, y + dy, c);
    }
  }
}

// Even-odd scanline fill for a simple polygon.
function fillPoly(points: Array<[number, number]>, c: RGB): void {
  let minY = H;
  let maxY = 0;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, xs[k]); x <= Math.min(W - 1, xs[k + 1]); x++) {
        setPixel(x, y, c);
      }
    }
  }
}

// --------------------------------------------------------------------- font
// 5x7 bitmap glyphs: seven rows of five bits. All copy is set in capitals,
// so only capitals, digits and common punctuation are needed.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

// Greedy word wrap: lines never exceed maxWidth pixels at this scale.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(x: number, y: number, text: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextBlock(
  x: number, y: number, text: string, scale: number, maxWidth: number,
  lineH: number, c: RGB,
): void {
  const lines = wrapText(text, maxWidth, scale);
  lines.forEach((ln, i) => drawText(x, y + i * lineH, ln, scale, c));
}

// --------------------------------------------------------------- PNG encode
const CRC_TABLE = (() => {
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
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------------- icons
// Small pictograms, one per story, drawn from primitives in the card's
// accent colour. Each fits in a 44x44 box whose top-left is (x, y).

// Container ship: stacked boxes, mast, hull, waterline.
function iconShip(x: number, y: number, c: RGB): void {
  fillRect(x + 6, y + 6, 8, 10, c);
  fillRect(x + 16, y + 6, 8, 10, c);
  fillRect(x + 26, y + 6, 8, 10, c);
  fillRect(x + 11, y + 2, 2, 6, c);
  fillPoly([[x + 2, y + 18], [x + 42, y + 18], [x + 36, y + 32], [x + 8, y + 32]], c);
  drawLine(x + 2, y + 38, x + 42, y + 38, c);
  drawLine(x + 8, y + 41, x + 36, y + 41, c);
}

// Missile burst: eight spikes from a centre disc, plus falling sparks.
function iconBurst(x: number, y: number, c: RGB): void {
  const cx = x + 22;
  const cy = y + 22;
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    const len = a % 2 === 0 ? 20 : 13;
    thickLine(
      Math.round(cx + 5 * Math.cos(rad)), Math.round(cy + 5 * Math.sin(rad)),
      Math.round(cx + len * Math.cos(rad)), Math.round(cy + len * Math.sin(rad)),
      4, c,
    );
  }
  fillCircle(cx, cy, 7, c);
  fillCircle(cx, cy, 3, CREAM);
  fillRect(x + 6, y + 38, 3, 3, c);
  fillRect(x + 36, y + 36, 3, 3, c);
}

// Megaphone: cone, grip, handle, sound ticks.
function iconMegaphone(x: number, y: number, c: RGB): void {
  fillPoly([[x + 4, y + 16], [x + 22, y + 6], [x + 22, y + 34], [x + 4, y + 26]], c);
  fillRect(x + 22, y + 10, 6, 20, c);
  fillRect(x + 30, y + 14, 4, 12, c);
  fillRect(x + 10, y + 30, 6, 10, c);
  drawLine(x + 34, y + 6, x + 40, y + 2, c);
  drawLine(x + 34, y + 34, x + 40, y + 38, c);
}

// Small boat on waves: cabin, hull, two wave strokes.
function iconBoat(x: number, y: number, c: RGB): void {
  fillRect(x + 16, y + 6, 12, 10, c);
  fillRect(x + 20, y + 2, 3, 6, c);
  fillPoly([[x + 4, y + 18], [x + 40, y + 18], [x + 33, y + 30], [x + 11, y + 30]], c);
  drawLine(x + 2, y + 36, x + 16, y + 36, c);
  drawLine(x + 20, y + 36, x + 34, y + 36, c);
  drawLine(x + 38, y + 36, x + 42, y + 36, c);
  drawLine(x + 8, y + 41, x + 22, y + 41, c);
  drawLine(x + 26, y + 41, x + 38, y + 41, c);
}

// Gear: eight spokes, outer disc, hub hole.
function iconGear(x: number, y: number, c: RGB): void {
  const cx = x + 22;
  const cy = y + 22;
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    thickLine(
      Math.round(cx + 8 * Math.cos(rad)), Math.round(cy + 8 * Math.sin(rad)),
      Math.round(cx + 19 * Math.cos(rad)), Math.round(cy + 19 * Math.sin(rad)),
      5, c,
    );
  }
  fillCircle(cx, cy, 11, c);
  fillCircle(cx, cy, 4, CREAM);
}

// Sigma: four strokes spelling the summation sign.
function iconSigma(x: number, y: number, c: RGB): void {
  thickLine(x + 36, y + 6, x + 8, y + 6, 4, c);
  thickLine(x + 8, y + 6, x + 30, y + 22, 4, c);
  thickLine(x + 30, y + 22, x + 8, y + 38, 4, c);
  thickLine(x + 8, y + 38, x + 36, y + 38, 4, c);
}

// Globe: circle, two meridian ellipses, latitude chords, polar axis.
function drawGlobe(cx: number, cy: number, r: number, c: RGB): void {
  circleOutline(cx, cy, r, 2, c);
  ellipseOutline(cx, cy, Math.round(r * 0.45), r, 2, c);
  ellipseOutline(cx, cy, Math.round(r * 0.85), Math.round(r * 0.45), 2, c);
  for (const dy of [-Math.round(r * 0.5), 0, Math.round(r * 0.5)]) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    drawLine(cx - half, cy + dy, cx + half, cy + dy, c);
  }
  drawLine(cx, cy - r, cx, cy + r, c);
}

// ------------------------------------------------------------------- layout
interface Story {
  tag: string;
  tagColor: RGB;
  headline: string;
  body: string;
  icon: (x: number, y: number, c: RGB) => void;
}

// Wrap budget, verified by hand: card headline/body at scale 4 fit 18 chars
// a line (448px); hero headline at scale 5 fits 25 chars (768px), hero body
// at scale 4 fits 32 chars (768px). Every text below wraps to at most 2 lines.
const HERO_TAG = "CLIMATE - ANTALYA, TURKEY";
const HERO_HEADLINE = "COP31 PUTS FINAL DEAL TO A VOTE";
const HERO_BODY = "NO FOSSIL FUELS NAMED. EU CALLS IT A STEP BACK.";

const STORIES: Story[] = [
  {
    tag: "WAR - UKRAINE",
    tagColor: RED,
    headline: "STRIKE ON ZELENSKYY'S CITY",
    body: "2 KILLED, 58 HURT IN KRYVYI RIH.",
    icon: iconBurst,
  },
  {
    tag: "TRADE - BRUSSELS",
    tagColor: TEAL,
    headline: "EU AND INDONESIA SIGN TRADE DEAL",
    body: "98.5% OF TARIFFS TO GO.",
    icon: iconShip,
  },
  {
    tag: "PROTEST - FRANCE",
    tagColor: AMBER,
    headline: "FRENCH PROTESTS HIT SIXTH WEEKEND",
    body: "82,500 MARCH ACROSS FRANCE.",
    icon: iconMegaphone,
  },
  {
    tag: "BOAT - NIGERIA",
    tagColor: RED,
    headline: "NIGERIA BOAT DEATH TOLL HITS 24",
    body: "BOAT CAPSIZED ON WAY TO FUNERAL.",
    icon: iconBoat,
  },
  {
    tag: "LABOUR - GERMANY",
    tagColor: TEAL,
    headline: "IG METALL CALLS MONDAY STRIKE",
    body: "23,000 AT 19 FIRMS WALK OUT MONDAY.",
    icon: iconGear,
  },
  {
    tag: "SCIENCE - USA",
    tagColor: AMBER,
    headline: "TWO RIEMANN CLAIMS IN ONE DAY",
    body: "ONE WITH AI, ONE BY HAND.",
    icon: iconSigma,
  },
];

function drawMasthead(): void {
  drawText(20, 20, "THE WORLD IN ONE DAY", 4, AMBER);
  drawText(20, 56, "SUNDAY 22 NOVEMBER 2026", 6, CREAM);
  drawText(20, 104, "SEVEN STORIES FROM AROUND THE GLOBE", 4, CREAM);
  drawGlobe(948, 62, 34, AMBER);
  fillRect(20, 132, 984, 4, AMBER);
}

function drawHero(): void {
  fillRect(20, 144, 984, 240, CREAM);
  fillRect(20, 144, 984, 6, RED);
  drawGlobe(120, 264, 72, NAVY);
  drawText(216, 164, HERO_TAG, 4, RED);
  drawTextBlock(216, 200, HERO_HEADLINE, 5, 768, 36, INK);
  drawTextBlock(216, 278, HERO_BODY, 4, 768, 30, INK);
}

function drawCard(x: number, y: number, s: Story): void {
  fillRect(x, y, 480, 186, CREAM);
  fillRect(x, y, 480, 4, s.tagColor);
  s.icon(x + 16, y + 12, s.tagColor);
  drawText(x + 70, y + 20, s.tag, 4, s.tagColor);
  drawTextBlock(x + 16, y + 62, s.headline, 4, 448, 30, INK);
  drawTextBlock(x + 16, y + 126, s.body, 4, 448, 28, INK);
}

function drawFooter(): void {
  drawText(20, 984, "SOURCES: REUTERS, AP, NATURE, EU, UKRMEDIA", 3, GREY);
}

function render(): void {
  fillRect(0, 0, W, H, NAVY);
  drawMasthead();
  drawHero();
  STORIES.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawCard(20 + col * 504, 396 + row * 192, s);
  });
  drawFooter();
}

// --------------------------------------------------------------------- main
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
render();
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), encodePng());
