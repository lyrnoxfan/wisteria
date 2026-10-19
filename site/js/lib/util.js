// 通用小工具：数学、颜色、随机、噪声、URL 参数

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
export const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const lighten = (c, t) => mix(c, [255, 255, 255], t);
export const darken = (c, t) => mix(c, [0, 0, 0], t);
export const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.f = mulberry32(seed >>> 0);
  }
  next() {
    return this.f();
  }
  range(a, b) {
    return a + this.f() * (b - a);
  }
  int(a, b) {
    return Math.floor(a + this.f() * (b - a + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.f() * arr.length)];
  }
  chance(p) {
    return this.f() < p;
  }
  sign() {
    return this.f() < 0.5 ? -1 : 1;
  }
  weighted(weights) {
    let s = 0;
    for (const w of weights) s += w;
    let r = this.f() * s;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
}

// 运行时事件用的随机（不需要可复现）
export const R = (a, b) => a + Math.random() * (b - a);
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// URL 参数：?seed= 固定布局；?hour=18.5 固定时刻；?speed=60 时间流速；?fuji=violet|white|pink
const q = new URLSearchParams(location.search);
const num = (k) => (q.has(k) && q.get(k) !== '' && isFinite(+q.get(k)) ? +q.get(k) : null);
export const params = {
  seed: num('seed'),
  hour: num('hour'),
  speed: num('speed') || 1,
  fuji: q.get('fuji'),
  mute: q.has('mute'),
};

// 一维平滑值噪声，范围约 [-1, 1]
const P = new Float32Array(1024);
{
  const r = mulberry32(20260419);
  for (let i = 0; i < 1024; i++) P[i] = r() * 2 - 1;
}
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = P[i & 1023];
  const b = P[(i + 1) & 1023];
  return a + (b - a) * f * f * (3 - 2 * f);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  c.ctx = c.getContext('2d');
  return c;
}
