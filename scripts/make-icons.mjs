// Makes every app icon from ONE picture of your logo.
//
//   1. Save your logo as branding/logo.png: square, at least 1024×1024, the mark
//      filling the picture edge to edge (padding is added here), on a solid background.
//   2. Set BG below to that background colour.
//   3. Run:  npm run icons
//
// Without branding/logo.png it uses branding/logo-source.svg (the old placeholder).
// Outputs go to public/icons/ and are picked up by the app automatically.
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";

const SRC = existsSync("branding/logo.png") ? "branding/logo.png" : "branding/logo-source.svg";
const OUT = "public/icons";
const BG = "#fef9ee"; // cream background of the logo
mkdirSync(OUT, { recursive: true });

const mark = (size) => sharp(SRC, { density: 600 }).resize(size, size, { fit: "contain", background: BG }).png().toBuffer();

// Logo centred on a background square. scale = how much of the square the mark fills;
// radius = rounded corners (0 = square, for icons the phone shapes itself).
async function icon(size, scale, radius, file) {
  const r = Math.round(size * radius);
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/></svg>`);
  await sharp(tile).composite([{ input: await mark(Math.round(size * scale)), gravity: "center" }]).png().toFile(`${OUT}/${file}`);
}

// Browser tab + Chrome install + in-app logo: rounded cream tile
await icon(32, 0.9, 0.2, "icon-32.png");
await icon(192, 0.8, 0.22, "icon-192.png");
await icon(512, 0.8, 0.22, "icon-512.png");
await icon(128, 0.82, 0.22, "mark.png");
// "Maskable": Android may crop to a circle, so the mark stays in the middle 62%
await icon(192, 0.62, 0, "maskable-192.png");
await icon(512, 0.62, 0, "maskable-512.png");
// iPhone home screen: full square, iOS rounds the corners itself
await icon(180, 0.8, 0, "apple-touch-icon.png");

console.log(`Icons made from ${SRC} → ${OUT}/`);
