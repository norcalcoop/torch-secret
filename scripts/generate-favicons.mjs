/**
 * One-time favicon generation script.
 *
 * Converts client/public/favicon.svg into:
 *   - client/public/favicon.ico  (32x32 ICO)
 *   - client/public/apple-touch-icon.png (180x180 PNG)
 *
 * This is NOT part of the build pipeline. Run it manually whenever
 * the shield design changes:
 *
 *   npm install --save-dev sharp
 *   node scripts/generate-favicons.mjs
 *   npm uninstall sharp
 *
 * The generated binary files are committed to git as static assets.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC = resolve(ROOT, "client/public");

/**
 * Build a minimal ICO file wrapping a single PNG payload.
 * ICO format: 6-byte header + 16-byte directory entry + PNG data.
 */
function buildIco(pngBuffer, width, height) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize;

  const ico = Buffer.alloc(dataOffset + pngBuffer.length);

  // ICONDIR header
  ico.writeUInt16LE(0, 0);           // reserved
  ico.writeUInt16LE(1, 2);           // type: 1 = ICO
  ico.writeUInt16LE(1, 4);           // count: 1 image

  // ICONDIRENTRY
  ico.writeUInt8(width >= 256 ? 0 : width, 6);   // width  (0 = 256)
  ico.writeUInt8(height >= 256 ? 0 : height, 7);  // height (0 = 256)
  ico.writeUInt8(0, 8);              // color palette count
  ico.writeUInt8(0, 9);              // reserved
  ico.writeUInt16LE(1, 10);          // color planes
  ico.writeUInt16LE(32, 12);         // bits per pixel
  ico.writeUInt32LE(pngBuffer.length, 14); // size of PNG data
  ico.writeUInt32LE(dataOffset, 18); // offset to PNG data

  pngBuffer.copy(ico, dataOffset);
  return ico;
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "Error: sharp is not installed.\n" +
      "Run: npm install --save-dev sharp\n" +
      "Then re-run this script."
    );
    process.exit(1);
  }

  const svgPath = resolve(PUBLIC, "favicon.svg");
  const svgBuffer = await readFile(svgPath);
  console.log(`Read SVG: ${svgPath} (${svgBuffer.length} bytes)`);

  // Use the light-mode color (#4d8bf5) for static raster fallbacks.
  // Dark mode adaptation is only available via the SVG favicon.

  // Generate 32x32 PNG for ICO wrapping
  const png32 = await sharp(svgBuffer, { density: 300 })
    .resize(32, 32)
    .png()
    .toBuffer();

  const icoBuffer = buildIco(png32, 32, 32);
  const icoPath = resolve(PUBLIC, "favicon.ico");
  await writeFile(icoPath, icoBuffer);
  console.log(`Written: ${icoPath} (${icoBuffer.length} bytes)`);

  // Generate 180x180 PNG for Apple Touch Icon
  const png180 = await sharp(svgBuffer, { density: 300 })
    .resize(180, 180)
    .png()
    .toBuffer();

  const applePath = resolve(PUBLIC, "apple-touch-icon.png");
  await writeFile(applePath, png180);
  console.log(`Written: ${applePath} (${png180.length} bytes)`);

  console.log("\nDone. You can now uninstall sharp: npm uninstall sharp");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
