// 声音：全部实时合成，不加载任何音频文件
//   树莺（ウグイス）"ホー…ホケキョ" 与"谷渡り"；绣眼细高的"チー"；麻雀"チュン"；燕子呢喃；
//   乌鸦远远的"カー"；傍晚远寺的钟（带"うなり"拍频）；夜里猫头鹰；脚步、振翅、拨花的沙沙
import { A, audioOn, voiceOut } from './engine.js';
import { R, chance } from '../lib/util.js';

const now = () => A.ac.currentTime;

// 一个带频率轮廓的音符：freqs 在 dur 内均匀分布
function note(dest, t, dur, freqs, peak, opt = {}) {
  const ac = A.ac;
  const o = ac.createOscillator();
  o.type = opt.type || 'sine';
  const n = freqs.length;
  o.frequency.setValueAtTime(freqs[0], t);
  for (let i = 1; i < n; i++) o.frequency.linearRampToValueAtTime(freqs[i], t + (dur * i) / (n - 1));
  const g = ac.createGain();
  const att = opt.att ?? Math.min(0.015, dur * 0.25);
  const rel = opt.rel ?? dur * 0.35;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + att);
  g.gain.setValueAtTime(peak, t + Math.max(att, dur - rel));
  g.gain.linearRampToValueAtTime(0, t + dur);
  if (opt.vib) {
    const v = ac.createOscillator();
    v.frequency.value = opt.vib[0];
    const vg = ac.createGain();
    vg.gain.value = opt.vib[1];
    v.connect(vg);
    vg.connect(o.frequency);
    v.start(t);
    v.stop(t + dur + 0.02);
  }
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
  return t + dur;
}

function noiseBurst(dest, t, dur, peak, type, freq, q) {
  const ac = A.ac;
  const s = ac.createBufferSource();
  s.buffer = A.noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + Math.min(0.006, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.02);
}

// ── 树莺 ──
export function uguisu(pan = R(-0.7, 0.7)) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.32, 0.85, 7500);
  const reps = chance(0.6) ? 2 : chance(0.5) ? 3 : 1;
  let t = now() + 0.1;
  for (let r = 0; r < reps; r++) {
    const vol = R(0.1, 0.14);
    const d1 = R(1.0, 1.55), f0 = R(1180, 1380);
    // "ホー"：长而纯的口哨，渐强、尾音微升
    const ac = A.ac;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0 * 0.96, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.25);
    o.frequency.linearRampToValueAtTime(f0 * 1.045, t + d1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.3);
    g.gain.linearRampToValueAtTime(vol, t + d1 - 0.07);
    g.gain.linearRampToValueAtTime(0, t + d1);
    const h = ac.createGain();
    h.gain.value = 0.07;
    const o2 = ac.createOscillator();
    o2.frequency.setValueAtTime(f0 * 1.92, t);
    o2.frequency.linearRampToValueAtTime(f0 * 2.09, t + d1);
    o.connect(g);
    o2.connect(h);
    h.connect(g);
    g.connect(out);
    o.start(t); o2.start(t);
    o.stop(t + d1 + 0.02); o2.stop(t + d1 + 0.02);
    t += d1 + R(0.05, 0.1);
    // "ホ"
    note(out, t, 0.1, [2150, 2420, 2260], vol * 0.75);
    t += 0.125;
    // "ケ"
    note(out, t, 0.055, [2700, 3950, 3050], vol * 0.9);
    t += 0.075;
    // "キョ"：先落后扬，带一点颤
    note(out, t, 0.32, [3350, 2550, 2700, 3300], vol, { vib: [34, 110] });
    t += 0.32 + R(3.5, 6.5);
  }
}

// ── 树莺"谷渡り"：ケキョケキョケキョ… ──
export function uguisuValley(pan = R(-0.7, 0.7)) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.3, 0.85, 7500);
  let t = now() + 0.1;
  const n = Math.floor(R(6, 13));
  const vol = R(0.07, 0.1);
  for (let i = 0; i < n; i++) {
    const fade = i < 2 ? 0.6 + i * 0.2 : i > n - 3 ? 0.75 : 1;
    note(out, t, 0.05, [2800, 3700, 3100], vol * fade);
    note(out, t + 0.07, 0.1, [3400, 2650, 2900], vol * fade, { vib: [30, 80] });
    t += R(0.2, 0.24);
  }
}

// ── 绣眼："チー" 细高短促 ──
export function mejiro(pan = 0, n = 2) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.55, 0.45, 9000);
  let t = now() + 0.03;
  for (let i = 0; i < n; i++) {
    const f = R(5400, 6800), d = R(0.05, 0.09);
    note(out, t, d, [f * 1.08, f, f * 0.9], R(0.04, 0.06), { att: 0.006 });
    t += d + R(0.07, 0.22);
  }
}

// ── 绣眼的鸣唱：一串快速的高音 ──
export function mejiroSong(pan = 0) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.5, 0.5, 9500);
  let t = now() + 0.05;
  const n = Math.floor(R(10, 19));
  for (let i = 0; i < n; i++) {
    const f = R(3600, 7200), d = R(0.035, 0.065);
    note(out, t, d, [f, f * R(0.8, 1.25), f * R(0.85, 1.1)], R(0.025, 0.045), { att: 0.005 });
    t += d + R(0.008, 0.04);
  }
}

// ── 麻雀："チュン" ──
export function sparrow(pan = 0) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.55, 0.4, 7000);
  const ac = A.ac;
  let t = now() + 0.03;
  const n = chance(0.5) ? 2 : chance(0.5) ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = R(3200, 3900);
    bp.Q.value = 2.2;
    bp.connect(out);
    const d = R(0.06, 0.09);
    note(bp, t, d, [R(4300, 4800), R(3300, 3600), R(3000, 3200)], 0.16, { type: 'triangle', att: 0.005 });
    t += d + R(0.08, 0.2);
  }
}

// ── 燕子：细碎的呢喃 ──
export function swallow(pan = 0) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.5, 0.5, 9000);
  let t = now() + 0.02;
  const n = Math.floor(R(4, 9));
  for (let i = 0; i < n; i++) {
    const f = R(3800, 6200), d = R(0.025, 0.045);
    note(out, t, d, [f, f * R(1.1, 1.3), f * 0.9], R(0.025, 0.04), { att: 0.004 });
    t += d + R(0.012, 0.05);
  }
}

// ── 乌鸦：远处的"カー" ──
export function crow(pan = 0, n = 2) {
  if (!audioOn()) return;
  const ac = A.ac;
  const out = voiceOut(pan, 0.22, 1.0, 2600);
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 3.5;
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass'; f2.frequency.value = 2250; f2.Q.value = 5;
  const g2 = ac.createGain();
  g2.gain.value = 0.6;
  f1.connect(out);
  f2.connect(g2);
  g2.connect(out);
  let t = now() + 0.05;
  const base = R(520, 640);
  for (let i = 0; i < n; i++) {
    const d = R(0.32, 0.46);
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 0.94, t);
    o.frequency.linearRampToValueAtTime(base, t + 0.06);
    o.frequency.linearRampToValueAtTime(base * 0.82, t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.035);
    g.gain.linearRampToValueAtTime(0.08, t + d * 0.6);
    g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g);
    g.connect(f1);
    g.connect(f2);
    o.start(t);
    o.stop(t + d + 0.02);
    t += d + R(0.25, 0.45);
  }
}

// ── 远寺的钟：低沉，带拍频的"うなり"，余音很长 ──
export function bell() {
  if (!audioOn()) return;
  const ac = A.ac;
  const out = voiceOut(R(-0.35, 0.35), 0.4, 0.95, 1900);
  const t = now() + 0.1;
  const f = R(84, 96);
  const parts = [
    [0.5, 0.32, 20], [1, 1, 17], [1.0068, 0.62, 16], [2.02, 0.42, 10],
    [2.76, 0.3, 7.5], [3.93, 0.17, 5], [5.4, 0.1, 3.2], [6.95, 0.06, 2.2],
  ];
  const vol = 0.11;
  for (const [ratio, amp, dec] of parts) {
    const o = ac.createOscillator();
    o.frequency.value = f * ratio;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.012);
    g.gain.setTargetAtTime(0, t + 0.03, dec / 4.5);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dec + 0.5);
  }
  // 撞木的闷击
  noiseBurst(out, t, 0.12, 0.09, 'lowpass', 380, 0.7);
}

// ── 夜里远处的猫头鹰 ──
export function owl(pan = R(-0.7, 0.7)) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.25, 0.95, 1300);
  let t = now() + 0.1;
  const f = R(350, 410);
  const vol = 0.07;
  const seq = chance(0.5) ? [[0.5, 1], [0.32, 0], [0.22, 0.9], [0.18, 0], [0.55, 1]] : [[0.6, 1], [0.4, 0], [0.7, 0.95]];
  for (const [d, on] of seq) {
    if (on) note(out, t, d, [f * 0.97, f, f * 0.96], vol * on, { att: 0.07, rel: d * 0.5 });
    t += d;
  }
}

// ── 脚步：碎石小路上轻轻的一声 ──
export function step(pan = 0, k = 1) {
  if (!audioOn()) return;
  const out = voiceOut(pan, 0.7, 0.15, 0);
  const t = now() + 0.01;
  noiseBurst(out, t, R(0.06, 0.09), 0.035 * k, 'bandpass', R(1100, 1700), 0.9);
  note(out, t, 0.04, [130, 90], 0.018 * k, { att: 0.003 });
}

// ── 振翅起飞 ──
export function flutter(pan = 0) {
  if (!audioOn()) return;
  const ac = A.ac;
  const out = voiceOut(pan, 0.6, 0.3, 0);
  const t = now() + 0.01;
  const s = ac.createBufferSource();
  s.buffer = A.noise;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1300;
  f.Q.value = 1.1;
  const g = ac.createGain();
  g.gain.value = 0;
  const am = ac.createOscillator();
  am.type = 'triangle';
  am.frequency.value = R(17, 24);
  const amg = ac.createGain();
  amg.gain.value = 0.03;
  am.connect(amg);
  amg.connect(g.gain);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.02);
  env.gain.linearRampToValueAtTime(0, t + R(0.25, 0.4));
  s.connect(f);
  f.connect(g);
  g.connect(env);
  env.connect(out);
  s.start(t, Math.random());
  am.start(t);
  s.stop(t + 0.45);
  am.stop(t + 0.45);
}

// ── 手指拨过花串的沙沙 ──
let lastBrush = 0;
export function brush(pan = 0, energy = 0.5) {
  if (!audioOn()) return;
  const t = now();
  if (t - lastBrush < 0.07) return;
  lastBrush = t;
  const out = voiceOut(pan, 0.7, 0.2, 0);
  noiseBurst(out, t + 0.005, R(0.12, 0.2), 0.018 + energy * 0.035, 'highpass', R(2600, 3600), 0.7);
}
