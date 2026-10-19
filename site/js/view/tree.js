// 树：整张水墨树图切成横条，越往上随风偏得越多（弹簧惯性），
// 入场时自下而上"长"出来；昼夜通过 source-atop 染色。
import { S, parX, parY } from './stage.js';
import { clamp, rgba, makeCanvas } from '../lib/util.js';

const DEPTH = 0.6;
let img = null;
let base = null;
let tinted = null;
let tintKey = '';
const sway = { bend: 0, vel: 0, flutter: 0 };

export function initTree(image) {
  img = image;
}

export function layoutTree() {
  const w = Math.round(S.tree.w * S.dpr);
  const h = Math.round(S.tree.h * S.dpr);
  base = makeCanvas(w, h);
  base.ctx.imageSmoothingQuality = 'high';
  base.ctx.drawImage(img, 0, 0, w, h);
  tinted = makeCanvas(w, h);
  tintKey = '';
}

export function tintTree(pal) {
  const k = pal.ink.map((v) => v | 0).join(',') + (pal.inkA * 100).toFixed(0);
  if (k === tintKey) return;
  tintKey = k;
  const g = tinted.ctx;
  g.globalCompositeOperation = 'copy';
  g.drawImage(base, 0, 0);
  if (pal.inkA > 0.004) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rgba(pal.ink, pal.inkA);
    g.fillRect(0, 0, tinted.width, tinted.height);
  }
  g.globalCompositeOperation = 'source-over';
}

export function updateTree(dt, wind) {
  const target = wind.at(S.tree.baseX, S.t - 0.15);
  // 阻尼弹簧：老藤有分量，跟风慢半拍
  const k = 5.5, c = 2.6;
  sway.vel += ((target - sway.bend) * k - sway.vel * c) * dt;
  sway.bend += sway.vel * dt;
  sway.flutter = 0.25 + Math.min(1, Math.abs(sway.bend) + wind.level * 0.6);
}

// 屏幕 y 处树的水平位移（不含视差）
export function swayAt(y) {
  const u = clamp((S.tree.y + S.tree.h - y) / S.tree.h, 0, 1);
  const H = S.tree.h;
  return sway.bend * H * 0.016 * u * u * (1.5 - 0.5 * u) + Math.sin(S.t * 1.7 + u * 7) * u * u * u * H * 0.0017 * sway.flutter;
}

// 树图上的归一化坐标 → 当前屏幕坐标
export function treePoint(fx, fy, out, depth = DEPTH) {
  const y = S.tree.y + fy * S.tree.h;
  out.x = S.tree.x + fx * S.tree.w + swayAt(y) + parX(depth);
  out.y = y + parY(depth);
  return out;
}

export function drawTree(ctx) {
  if (!tinted) return;
  const T = S.tree;
  const d = S.dpr;
  const band = 6;
  const n = Math.ceil(T.h / band);
  const reveal = S.reveal;
  const ox = parX(DEPTH), oy = parY(DEPTH);
  const sw = tinted.width, shMax = tinted.height;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  for (let i = 0; i < n; i++) {
    const y = T.y + i * band;
    const hb = Math.min(band, T.y + T.h - y);
    if (hb <= 0) break;
    const v = (T.y + T.h - y - hb / 2) / T.h; // 0 树根 ~ 1 树梢
    let a = 1;
    if (reveal < 1) {
      a = clamp((reveal * 1.18 - v) / 0.16, 0, 1);
      if (a <= 0) continue;
    }
    const sy = Math.floor(i * band * d);
    const sh = Math.min(Math.ceil(hb * d) + 1, shMax - sy);
    if (sh <= 0) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(tinted, 0, sy, sw, sh, T.x + swayAt(y + hb / 2) + ox, y + oy, T.w, sh / d);
  }
  ctx.globalAlpha = 1;
}
