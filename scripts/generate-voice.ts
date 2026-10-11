// Records the cinematic narration for every cutscene line with Piper, an offline neural text-to-speech engine,
// then gives it a warm, cinematic finish and writes a manifest of real durations so captions stay in sync.
// Requires .tools/piper (piper.exe + en_GB-jenny_dioco-medium voice). Run: npx tsx scripts/generate-voice.ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// lamejs ships as ESM only, so it is loaded with a dynamic import (see the bottom of this file).
let Mp3Encoder: typeof import('@breezystack/lamejs').Mp3Encoder;
import { chapters, ending, prologue } from '../src/game/chapters';

const root = path.join(__dirname, '..');
const piper = path.join(root, '.tools', 'piper', 'piper', 'piper.exe');
const model = path.join(root, '.tools', 'piper', 'en_GB-jenny_dioco-medium.onnx');
const outDir = path.join(root, 'assets', 'voice');
const tmp = path.join(root, '.tools', 'piper', 'tmp');
const SR = 22050;
const TAU = Math.PI * 2;

/** Every narrated line, with a slower, softer delivery for the most dramatic beats. */
interface Line { id: string; text: string; pace: number; mood: 'calm' | 'dark' | 'awe' | 'triumph' }
const lines: Line[] = [];
prologue.forEach((text, i) => lines.push({ id: `prologue${i}`, text, pace: i === 2 || i === 3 ? 1.28 : 1.16, mood: i === 2 || i === 3 ? 'dark' : i === 4 ? 'awe' : 'calm' }));
chapters.forEach(c => {
  c.intro.forEach((text, i) => lines.push({ id: `intro${c.id}_${i}`, text, pace: 1.14, mood: i === c.intro.length - 1 ? 'awe' : 'calm' }));
  c.outro.forEach((text, i) => lines.push({ id: `outro${c.id}_${i}`, text, pace: 1.12, mood: i === 0 ? 'triumph' : 'calm' }));
  c.forge.forEach((text, i) => lines.push({ id: `forge${c.id}_${i}`, text, pace: 1.16, mood: i === 1 ? 'triumph' : 'awe' }));
});
ending.forEach((text, i) => lines.push({ id: `ending${i}`, text, pace: 1.2, mood: i === 3 ? 'calm' : 'awe' }));

/** Spoken form: ellipses and commas give the voice room to breathe on dramatic lines. */
function spoken(l: Line) {
  let t = l.text.replace(/\.\.\./g, ', ').replace(/\s+/g, ' ').trim();
  if (l.mood === 'dark') t = t.replace(/^Then /, 'Then, ');
  return t;
}

function readWav(file: string) {
  const b = fs.readFileSync(file);
  let p = 12, data: Buffer | undefined, rate = SR;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') rate = b.readUInt32LE(p + 12);
    if (id === 'data') data = b.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size % 2);
  }
  if (!data || rate !== SR) throw new Error(`${file}: unexpected WAV format (${rate} Hz)`);
  const out = new Float32Array(data.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = data.readInt16LE(i * 2) / 32768;
  return out;
}

function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]!; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** RBJ cookbook filters. */
function filter(x: Float32Array, kind: 'hp' | 'lp' | 'shelfLow' | 'peak' | 'shelfHigh', f: number, q = .707, dB = 0) {
  const w = TAU * f / SR, cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q), A = 10 ** (dB / 40);
  let b0, b1, b2, a0, a1, a2;
  if (kind === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  else if (kind === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  else if (kind === 'peak') { b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; }
  else {
    const s = 2 * Math.sqrt(A) * alpha, sign = kind === 'shelfLow' ? 1 : -1;
    b0 = A * ((A + 1) - sign * (A - 1) * cos + s); b1 = sign * 2 * A * ((A - 1) - sign * (A + 1) * cos); b2 = A * ((A + 1) - sign * (A - 1) * cos - s);
    a0 = (A + 1) + sign * (A - 1) * cos + s; a1 = -sign * 2 * ((A - 1) + sign * (A + 1) * cos); a2 = (A + 1) + sign * (A - 1) * cos - s;
  }
  return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
}

/** Smooth compressor: evens out the delivery like a voice-over booth chain. */
function compress(x: Float32Array, threshold = .18, ratio = 3) {
  const y = new Float32Array(x.length);
  let envl = 0;
  const att = 1 - Math.exp(-1 / (SR * .005)), rel = 1 - Math.exp(-1 / (SR * .12));
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    envl += (a > envl ? att : rel) * (a - envl);
    const gain = envl > threshold ? (threshold + (envl - threshold) / ratio) / envl : 1;
    y[i] = x[i]! * gain;
  }
  return y;
}

/** A soft hall: a few diffused, darkened taps rather than an obvious echo. */
function hall(x: Float32Array, wet: number) {
  const tail = Math.floor(SR * 1.6);
  const y = new Float32Array(x.length + tail);
  y.set(x);
  const taps: [number, number][] = [[.031, .5], [.047, .45], [.061, .42], [.079, .38], [.097, .33], [.113, .3]];
  for (const [d, fb] of taps) {
    const delay = Math.floor(d * SR * 1.4);
    const line = new Float32Array(y.length);
    let lp = 0;
    for (let i = 0; i < y.length; i++) {
      const k = i - delay;
      lp += .35 * ((k >= 0 ? line[k]! : 0) - lp);
      line[i] = (i < x.length ? x[i]! : 0) + lp * fb * 1.6;
    }
    for (let i = 0; i < y.length; i++) y[i]! += line[i]! * wet / taps.length;
  }
  return y;
}

function trim(x: Float32Array) {
  const gate = .012;
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]!) < gate) a++;
  while (b > a && Math.abs(x[b]!) < gate) b--;
  return x.subarray(Math.max(0, a - Math.floor(SR * .02)), Math.min(x.length, b + Math.floor(SR * .08)));
}

function encode(x: Float32Array, file: string) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = .92 / Math.max(peak, 1e-4);
  const pcm = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, x[i]! * gain)) * 32760);
  const enc = new Mp3Encoder(1, SR, 64);
  const chunks: Buffer[] = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(Buffer.from(enc.encodeBuffer(pcm.subarray(i, i + 1152))));
  chunks.push(Buffer.from(enc.flush()));
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const moodFx = { calm: { wet: .22, warmth: 2.5 }, dark: { wet: .32, warmth: 3.5 }, awe: { wet: .3, warmth: 2.5 }, triumph: { wet: .26, warmth: 2 } };

async function main() {
Mp3Encoder = (await import('@breezystack/lamejs')).Mp3Encoder;
if (!fs.existsSync(piper) || !fs.existsSync(model)) throw new Error('Piper is missing: download it into .tools/piper first (see README).');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
const manifest: { id: string; text: string; ms: number }[] = [];
for (const l of lines) {
  const wav = path.join(tmp, `${l.id}.wav`);
  execFileSync(piper, ['--model', model, '--output_file', wav, '--length_scale', String(l.pace), '--noise_scale', '.72', '--noise_w', '.9', '--sentence_silence', '.45'],
    { input: spoken(l), stdio: ['pipe', 'ignore', 'ignore'] });
  const fx = moodFx[l.mood];
  let x = trim(readWav(wav));
  x = filter(x, 'hp', 75);
  x = filter(x, 'shelfLow', 220, .707, fx.warmth);
  x = filter(x, 'peak', 3200, 1.1, 1.5);
  x = filter(x, 'lp', 9500);
  x = compress(x);
  const lead = new Float32Array(Math.floor(SR * .12));
  const voiced = new Float32Array(lead.length + x.length);
  voiced.set(x, lead.length);
  const spokenMs = Math.round(voiced.length / SR * 1000);
  encode(hall(voiced, fx.wet), path.join(outDir, `${l.id}.mp3`));
  manifest.push({ id: l.id, text: l.text, ms: spokenMs });
  process.stdout.write(`${l.id}:${spokenMs} `);
}
fs.rmSync(tmp, { recursive: true, force: true });
const body = manifest.map(m => `  ${JSON.stringify(m.text)}: { source: require('../../assets/voice/${m.id}.mp3'), ms: ${m.ms} },`).join('\n');
fs.writeFileSync(path.join(root, 'src', 'services', 'voiceClips.ts'),
  `// Generated by scripts/generate-voice.ts. Do not edit by hand.\n/** Recorded narration per caption, with its spoken length (excluding the reverb tail). */\nexport const voiceClips: Record<string, { source: number; ms: number }> = {\n${body}\n};\n`);
console.log(`\nRecorded ${manifest.length} lines`);
}
void main();
