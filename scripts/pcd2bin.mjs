import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = join(__dirname, "..", "public", "models");

const files = ["example.pcd", "cube.pcd"];

for (const filename of files) {
  const pcdPath = join(MODELS_DIR, filename);
  const binPath = join(MODELS_DIR, filename.replace(".pcd", ".bin"));

  console.log(`Converting: ${filename}`);
  const raw = readFileSync(pcdPath, "utf-8");
  const lines = raw.split("\n");

  // Parse header
  let headerEnd = 0;
  let fields = ["x", "y", "z"];
  let pointCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("FIELDS")) {
      fields = line.split(/\s+/).slice(1);
    } else if (line.startsWith("POINTS")) {
      pointCount = parseInt(line.split(/\s+/)[1]);
    } else if (line.startsWith("DATA")) {
      headerEnd = i + 1;
      break;
    }
  }

  // Find x, y, z field indices
  const xi = fields.indexOf("x");
  const yi = fields.indexOf("y");
  const zi = fields.indexOf("z");
  if (xi < 0 || yi < 0 || zi < 0) {
    console.error(`  ERROR: x/y/z fields not found in ${filename}`);
    continue;
  }

  console.log(`  Fields: ${fields.join(", ")} | XYZ indices: ${xi},${yi},${zi}`);
  console.log(`  Points: ${pointCount}`);

  // Parse data lines
  const positions = new Float32Array(pointCount * 3);
  let written = 0;

  for (let i = headerEnd; i < lines.length && written < pointCount; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length <= Math.max(xi, yi, zi)) continue;

    const x = parseFloat(parts[xi]);
    const y = parseFloat(parts[yi]);
    const z = parseFloat(parts[zi]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

    const idx = written * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    written++;
  }

  console.log(`  Written: ${written} points`);

  // Write binary
  const buf = Buffer.from(positions.buffer, 0, written * 3 * 4);
  writeFileSync(binPath, buf);
  const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
  console.log(`  Output: ${binPath} (${sizeMB} MB)\n`);
}
