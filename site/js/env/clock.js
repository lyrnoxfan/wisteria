// 昼夜：按本地时间在一组"光"的关键帧之间插值
import { hex, lerp, clamp, smoothstep, smooth, params } from '../lib/util.js';

// sky0/sky1 天色上/下；glow 地平线余晖；ink 树的染色；flower 花的染色；haze 远景雾色（后排花串、霞）
// sun/moon/stars 可见度；mist 晨雾；shadow 树影；dapple 光斑；lightUp 夜间打光；life 鸟的活跃度；dark 夜色程度
const NIGHT = {
  sky0: hex('#10141f'), sky1: hex('#1f2638'), glow: hex('#5b4791'), glowA: 0.2,
  ink: hex('#121828'), inkA: 0.7, flower: hex('#24244e'), flowerA: 0.14, haze: hex('#2a3350'), hazeA: 0.5,
  sun: 0, moon: 1, stars: 1, mist: 0.12, shadow: 0.1, dapple: 0, lightUp: 1, life: 0.04, dark: 1,
};
const PREDAWN = {
  sky0: hex('#2a3050'), sky1: hex('#776a80'), glow: hex('#e2a594'), glowA: 0.3,
  ink: hex('#282c45'), inkA: 0.45, flower: hex('#454080'), flowerA: 0.12, haze: hex('#6d6a86'), hazeA: 0.42,
  sun: 0.08, moon: 0.45, stars: 0.35, mist: 0.6, shadow: 0.12, dapple: 0, lightUp: 0.35, life: 0.45, dark: 0.75,
};
const DAWN = {
  sky0: hex('#cdd0dc'), sky1: hex('#f4dccb'), glow: hex('#ffc19a'), glowA: 0.36,
  ink: hex('#6a5f78'), inkA: 0.16, flower: hex('#ffc0a8'), flowerA: 0.06, haze: hex('#f3e2d8'), hazeA: 0.55,
  sun: 0.72, moon: 0.06, stars: 0, mist: 0.85, shadow: 0.3, dapple: 0.3, lightUp: 0, life: 1, dark: 0.12,
};
const MORNING = {
  sky0: hex('#f3f2ee'), sky1: hex('#f9f2e8'), glow: hex('#ffd9b8'), glowA: 0.16,
  ink: hex('#8a7058'), inkA: 0.04, flower: hex('#ffd2b0'), flowerA: 0.03, haze: hex('#efe7dc'), hazeA: 0.5,
  sun: 0.2, moon: 0, stars: 0, mist: 0.35, shadow: 0.6, dapple: 0.75, lightUp: 0, life: 1, dark: 0,
};
const DAY = {
  sky0: hex('#fbfaf7'), sky1: hex('#f6f3ec'), glow: hex('#fff3e2'), glowA: 0,
  ink: hex('#000000'), inkA: 0, flower: hex('#000000'), flowerA: 0, haze: hex('#ebe7df'), hazeA: 0.45,
  sun: 0, moon: 0, stars: 0, mist: 0, shadow: 0.85, dapple: 1, lightUp: 0, life: 1, dark: 0,
};
const GOLDEN = {
  sky0: hex('#f7f0e3'), sky1: hex('#f5e0c3'), glow: hex('#ffc98c'), glowA: 0.26,
  ink: hex('#b0763c'), inkA: 0.07, flower: hex('#ffb070'), flowerA: 0.05, haze: hex('#efd8bb'), hazeA: 0.5,
  sun: 0.45, moon: 0, stars: 0, mist: 0.1, shadow: 0.7, dapple: 0.85, lightUp: 0, life: 0.9, dark: 0,
};
const SUNSET = {
  sky0: hex('#e3cdc4'), sky1: hex('#f0b593'), glow: hex('#ff9066'), glowA: 0.45,
  ink: hex('#743d48'), inkA: 0.2, flower: hex('#ff8c70'), flowerA: 0.08, haze: hex('#ebbca6'), hazeA: 0.5,
  sun: 1, moon: 0.05, stars: 0, mist: 0.3, shadow: 0.4, dapple: 0.4, lightUp: 0.12, life: 0.75, dark: 0.15,
};
const BLUE = {
  sky0: hex('#333a58'), sky1: hex('#837189'), glow: hex('#d98a8a'), glowA: 0.3,
  ink: hex('#232842'), inkA: 0.58, flower: hex('#383874'), flowerA: 0.13, haze: hex('#5a5576'), hazeA: 0.45,
  sun: 0, moon: 0.7, stars: 0.45, mist: 0.25, shadow: 0.15, dapple: 0, lightUp: 0.75, life: 0.25, dark: 0.7,
};

const KEYS = [
  [0, NIGHT], [4.4, NIGHT], [5.1, PREDAWN], [5.9, DAWN], [7.3, MORNING], [9.0, DAY],
  [15.6, DAY], [17.0, GOLDEN], [18.1, SUNSET], [18.9, BLUE], [19.8, NIGHT], [24, NIGHT],
];
const FIELDS = Object.keys(DAY);

export function paletteAt(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, a] = KEYS[i];
  const [h1, b] = KEYS[i + 1];
  const t = smooth(clamp((h - h0) / (h1 - h0 || 1), 0, 1));
  const p = { hour: h };
  for (const f of FIELDS) {
    const va = a[f], vb = b[f];
    p[f] = Array.isArray(va) ? [lerp(va[0], vb[0], t), lerp(va[1], vb[1], t), lerp(va[2], vb[2], t)] : lerp(va, vb, t);
  }
  // 太阳：清晨在左侧低处缓缓升起，傍晚在右侧慢慢落下
  if (h < 12) {
    p.sunX = 0.17;
    p.sunY = lerp(0.74, 0.5, smoothstep(5.2, 7.6, h));
  } else {
    p.sunX = 0.83;
    p.sunY = lerp(0.44, 0.8, smoothstep(16.4, 18.75, h));
  }
  p.sunWarm = h < 12 ? 0.55 : smoothstep(16.5, 18.4, h);
  return p;
}

// 0 = 新月，0.5 = 满月
export function moonPhase(date = new Date()) {
  const syn = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = date.getTime() / 86400000 - ref;
  return (((days / syn) % 1) + 1) % 1;
}

export class Clock {
  constructor() {
    this.fixed = params.hour;
    this.speed = params.speed;
    this.t0 = performance.now();
  }
  hour() {
    const elapsedH = ((performance.now() - this.t0) / 3600000) * this.speed;
    let h;
    if (this.fixed != null) h = this.fixed + elapsedH;
    else {
      const d = new Date();
      h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + elapsedH * (1 - 1 / this.speed);
    }
    return ((h % 24) + 24) % 24;
  }
}
