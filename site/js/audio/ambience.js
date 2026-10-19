// 环境风声：沿用 v3.2 认可的配方（粉噪主风 + 棕噪低频 + 高频叶动 + 两层慢 LFO 呼吸），
// 改成左右两路不相关的噪声，声场更宽；手指拨花时叶动会跟着响一下。
import { A } from './engine.js';

const amb = { ok: false };

function pinkBuffer(ac, secs) {
  const len = Math.floor(ac.sampleRate * secs);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // 首尾交叉淡化，循环无缝
  const fade = Math.floor(ac.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - t) + d[i] * t;
  }
  return buf;
}

function brownBuffer(ac, secs) {
  const len = Math.floor(ac.sampleRate * secs);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function chain(ac, buf, type, freq, q, pan) {
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(0, Math.random() * buf.duration);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.value = 0;
  s.connect(f);
  f.connect(g);
  let out = g;
  if (pan != null && ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  out.connect(A.master);
  return { f, g };
}

export function startAmbience() {
  if (amb.ok || !A.ac) return;
  const ac = A.ac;
  const pL = pinkBuffer(ac, 7.3), pR = pinkBuffer(ac, 6.1), br = brownBuffer(ac, 5.7);
  amb.windL = chain(ac, pL, 'lowpass', 500, 0.5, -0.55);
  amb.windR = chain(ac, pR, 'lowpass', 500, 0.5, 0.55);
  amb.deep = chain(ac, br, 'lowpass', 170, 0.5, null);
  amb.rustL = chain(ac, pR, 'highpass', 4200, 0.6, -0.4);
  amb.rustR = chain(ac, pL, 'highpass', 4200, 0.6, 0.4);
  amb.touch = 0;
  amb.ok = true;
}

export function rustleTouch(energy) {
  amb.touch = Math.min(1.2, (amb.touch || 0) + energy);
}

export function updateAmbience(dt, t, wind, pal) {
  if (!amb.ok) return;
  const w = Math.min(1, wind.level);
  const sm = (p, target, k) => {
    p.value += (target - p.value) * Math.min(1, dt * k);
  };
  const quiet = 1 - pal.dark * 0.15;
  const lfo1 = Math.sin(t * 0.13 + 1.7) * 0.5 + Math.sin(t * 0.071 + 0.4) * 0.5;
  const lfo1b = Math.sin(t * 0.117 + 0.3) * 0.5 + Math.sin(t * 0.083 + 2.2) * 0.5;
  const lfo2 = Math.sin(t * 0.21 + 3.1) * 0.5 + Math.sin(t * 0.113 + 1.2) * 0.5;
  const base = (0.035 + w * 0.38) * 0.78 * quiet;
  sm(amb.windL.g.gain, base * (1 + lfo1 * 0.28), 2.0);
  sm(amb.windR.g.gain, base * (1 + lfo1b * 0.28), 2.0);
  amb.windL.f.frequency.value = 380 + w * 380 + lfo2 * 130;
  amb.windR.f.frequency.value = 400 + w * 360 - lfo2 * 110;
  sm(amb.deep.g.gain, w * w * 0.5 * quiet, 1.5);
  const trem = 0.6 + 0.4 * Math.sin(t * 9.3) * Math.sin(t * 6.1 + 2.0);
  const trem2 = 0.6 + 0.4 * Math.sin(t * 8.1 + 1) * Math.sin(t * 5.3);
  amb.touch *= Math.exp(-3.2 * dt);
  const r = Math.pow(Math.max(0, w - 0.18), 1.4) * 0.5;
  sm(amb.rustL.g.gain, r * trem * 0.8 + amb.touch * 0.16, 6);
  sm(amb.rustR.g.gain, r * trem2 * 0.8 + amb.touch * 0.16, 6);
}
