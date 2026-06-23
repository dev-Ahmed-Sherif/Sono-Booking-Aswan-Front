import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleRate = 44100;
const durationSec = 3.5;
const numSamples = Math.floor(sampleRate * durationSec);
const dataSize = numSamples * 2;
const buffer = Buffer.alloc(44 + dataSize);

/** Classic bell inharmonic partials (ratio, amplitude, decay rate). */
const f0 = 1567.98; // G6 — higher pitch than prior E6 fundamental
const partials = [
  { ratio: 1.0, amp: 0.62, decay: 1.05 },
  { ratio: 2.0, amp: 0.46, decay: 1.55 },
  { ratio: 2.51, amp: 0.36, decay: 1.95 },
  { ratio: 3.0, amp: 0.3, decay: 2.45 },
  { ratio: 4.1, amp: 0.2, decay: 3.2 },
  { ratio: 5.4, amp: 0.12, decay: 4.0 },
];

buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i += 1) {
  const t = i / sampleRate;

  // Sharp strike transient + slow body decay for a full bell ring
  const strike = Math.exp(-t * 28) * 0.35;
  const body = Math.exp(-t * 0.95);

  let sample = strike;
  for (const { ratio, amp, decay } of partials) {
    const envelope = body * Math.exp(-t * decay * 0.35);
    sample += envelope * amp * Math.sin(2 * Math.PI * f0 * ratio * t);
  }

  const clamped = Math.max(-1, Math.min(1, sample * 0.92));
  buffer.writeInt16LE(Math.floor(clamped * 32767), 44 + i * 2);
}

const outDir = path.join(__dirname, "..", "public", "sounds");
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, "notification.wav");
fs.writeFileSync(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes, ${durationSec}s)`);
