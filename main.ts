// THE WORLD IN ONE DAY — Sunday 22 November 2026.
// A one-page broadsheet drawn from scratch: own 5x7 pixel font, own canvas,
// own PNG writer. No image assets, no network, no wall clock, deterministic.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// Palette: navy ink on warm cream paper, amber for tags and rules.
const NAVY: [number, number, number] = [20, 26, 46];
const CREAM: [number, number, number] = [245, 239, 224];
const AMBER: [number, number, number] = [232, 163, 61];
const PAPER: [number, number, number] = [255, 253, 245];
const BODY: [number, number, number] = [58, 62, 84];
const CARD_LINE: [number, number, number] = [20, 26, 46];

// Each glyph is 5 columns by 7 rows. "#" is ink, "." is empty.
// I drew every glyph by hand for this page.
const FONT: Record<string, string[]> = {
  "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "G": [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  "I": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  "J": ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["#...#", "#..#.", "...#.", "..#..", ".#...", "#..#.", "#...#"],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
};

const BLANK = FONT[" "];

// Raw RGB frame, row-major, 3 bytes per pixel.
const px = new Uint8Array(W * H * 3);

function put(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

// Filled disc drawn scanline by scanline.
function disc(cx: number, cy: number, r: number, c: [number, number, number]): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}

// One glyph at (x, y), scaled by s. Each font cell is 5 wide, 7 tall,
// with a 1-cell gap, so the advance is 6*s.
function glyph(ch: string, x: number, y: number, s: number, c: [number, number, number]): void {
  const rows = FONT[ch] ?? BLANK;
  for (let r = 0; r < 7; r++) {
    const row = rows[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") {
        rect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
}

function textWidth(t: string, s: number): number {
  if (t.length === 0) return 0;
  return t.length * 6 * s - s;
}

function drawText(t: string, x: number, y: number, s: number, c: [number, number, number]): void {
  let cx = x;
  for (const ch of t) {
    glyph(ch, cx, y, s, c);
    cx += 6 * s;
  }
}

function drawCentered(t: string, y: number, s: number, c: [number, number, number]): void {
  drawText(t, Math.floor((W - textWidth(t, s)) / 2), y, s, c);
}

// Greedy word wrap: lines of at most maxW pixels at scale s.
function wrap(t: string, maxW: number, s: number): string[] {
  const words = t.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (textWidth(next, s) <= maxW || cur === "") {
      cur = next;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Amber tag chip: amber block with navy text, padded 8px each side.
function tagChip(t: string, x: number, y: number): number {
  const w = textWidth(t, 2) + 16;
  rect(x, y, w, 24, AMBER);
  drawText(t, x + 8, y + 5, 2, NAVY);
  return w;
}

// ---- The day's stories (Sunday 22 November 2026) ----

type Story = { tag: string; head: string; body: string };

const HERO: Story = {
  tag: "CLIMATE - ANTALYA",
  head: "COP31 PUTS FINAL DEAL TO A VOTE",
  body: "NO FOSSIL FUELS NAMED. EU CALLS IT A STEP BACK.",
};

const CARDS: Story[] = [
  { tag: "WAR - UKRAINE", head: "STRIKE ON ZELENSKYY'S CITY", body: "2 KILLED, 58 HURT IN KRYVYI RIH." },
  { tag: "TRADE - BRUSSELS", head: "EU AND INDONESIA SIGN TRADE DEAL", body: "98.5% OF TARIFFS TO GO." },
  { tag: "PROTEST - FRANCE", head: "FRENCH PROTESTS HIT SIXTH WEEKEND", body: "82,500 MARCH ACROSS FRANCE." },
  { tag: "BOAT - NIGERIA", head: "NIGERIA BOAT DEATH TOLL HITS 24", body: "BOAT CAPSIZED ON WAY TO FUNERAL." },
  { tag: "LABOUR - GERMANY", head: "IG METALL CALLS MONDAY STRIKE", body: "23,000 AT 19 FIRMS WALK OUT MONDAY." },
  { tag: "SCIENCE - USA", head: "TWO RIEMANN CLAIMS IN ONE DAY", body: "ONE WITH AI, ONE BY HAND." },
];

const FOOTER = "SOURCES: REUTERS, AP, NATURE, EU, UKRMEDIA";

// ---- Decorative globe for the hero: amber disc, navy equator + meridian ----

function globe(cx: number, cy: number, r: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      // A band across the middle and a line down the centre read as a globe.
      if (Math.abs(dy) < 7 || Math.abs(dx) < 5) {
        put(x, y, NAVY);
      } else {
        put(x, y, AMBER);
      }
    }
  }
  // Thin cream ring around the disc.
  for (let a = 0; a < 360; a++) {
    const rad = (a * Math.PI) / 180;
    put(Math.round(cx + (r + 2) * Math.cos(rad)), Math.round(cy + (r + 2) * Math.sin(rad)), CREAM);
  }
}

// ---- Page layout ----

function masthead(): void {
  rect(32, 16, 960, 132, NAVY);
  drawCentered("THE WORLD IN ONE DAY", 30, 6, CREAM);
  drawCentered("SUNDAY 22 NOVEMBER 2026", 84, 3, AMBER);
  drawCentered("SEVEN STORIES FROM AROUND THE GLOBE", 114, 3, CREAM);
}

function hero(): void {
  rect(32, 168, 960, 212, NAVY);
  globe(150, 274, 72);
  tagChip(HERO.tag, 260, 188);
  const headLines = wrap(HERO.head, 560, 4);
  const bodyLines = wrap(HERO.body, 700, 3);
  if (headLines.length > 2 || bodyLines.length > 2) throw new Error("hero text overflows");
  let y = 226;
  for (const ln of headLines) {
    drawText(ln, 260, y, 4, CREAM);
    y += 30;
  }
  y = 302;
  for (const ln of bodyLines) {
    drawText(ln, 260, y, 3, CREAM);
    y += 24;
  }
}

function card(s: Story, x: number, y: number): void {
  rect(x, y, 472, 172, PAPER);
  // Navy border, 2px.
  rect(x, y, 472, 2, CARD_LINE);
  rect(x, y + 170, 472, 2, CARD_LINE);
  rect(x, y, 2, 172, CARD_LINE);
  rect(x + 470, y, 2, 172, CARD_LINE);
  tagChip(s.tag, x + 16, y + 14);
  const headLines = wrap(s.head, 436, 4);
  const bodyLines = wrap(s.body, 436, 3);
  if (headLines.length > 2 || bodyLines.length > 2) throw new Error("card text overflows: " + s.tag);
  let hy = y + 50;
  for (const ln of headLines) {
    drawText(ln, x + 16, hy, 4, NAVY);
    hy += 30;
  }
  let by = y + 120;
  for (const ln of bodyLines) {
    drawText(ln, x + 16, by, 3, BODY);
    by += 24;
  }
}

function footer(): void {
  rect(32, 952, 960, 3, NAVY);
  drawCentered(FOOTER, 966, 3, NAVY);
}

// ---- Minimal PNG writer: 8-bit RGB, one IDAT, zlib from the standard library ----

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- Run ----

function main(): void {
  rect(0, 0, W, H, PAPER);
  masthead();
  rect(32, 156, 960, 4, AMBER);
  hero();
  const xs = [32, 520];
  const ys = [396, 580, 764];
  for (let i = 0; i < CARDS.length; i++) {
    card(CARDS[i], xs[i % 2], ys[Math.floor(i / 2)]);
  }
  footer();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? ".";
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}

main();
