// 舞台：画布、尺寸、构图（树的位置与大小）与共享状态
import { clamp } from '../lib/util.js';
import { TREE } from '../data/tree.js';

export const S = {
  cv: null,
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  quality: 1,
  k: 1, // 尺度单位：树高 600px 时为 1
  groundY: 0,
  tree: { x: 0, y: 0, w: 0, h: 0, baseX: 0 },
  t: 0,
  dt: 1 / 60,
  pal: null,
  hour: 12,
  par: { x: 0, y: 0 }, // 视差 [-1, 1]
  revealT0: Infinity, // 树开始"长出来"的时刻
  reveal: 0,
  seed: 1,
  layoutJitter: { x: 0, s: 1 },
};

export function initStage(canvas) {
  S.cv = canvas;
  S.ctx = canvas.getContext('2d', { alpha: false });
}

export function layout() {
  const W = Math.max(1, window.innerWidth);
  const H = Math.max(1, window.innerHeight);
  S.W = W;
  S.H = H;
  S.dpr = Math.min(window.devicePixelRatio || 1, 2) * S.quality;
  S.cv.width = Math.round(W * S.dpr);
  S.cv.height = Math.round(H * S.dpr);
  S.cv.style.width = W + 'px';
  S.cv.style.height = H + 'px';

  const portrait = H > W;
  S.groundY = H * (portrait ? 0.915 : 0.93);
  // 竖屏让树冠略溢出两侧，横屏留出大片空白
  const byWidth = (W * (portrait ? 1.13 : 0.9)) / TREE.aspect;
  const th = Math.min(H * (portrait ? 0.86 : 0.88), byWidth) * S.layoutJitter.s;
  const tw = th * TREE.aspect;
  const jitter = clamp(S.layoutJitter.x * W, -tw * 0.06, tw * 0.06);
  S.tree.w = tw;
  S.tree.h = th;
  S.tree.x = (W - tw) / 2 + (0.5 - TREE.baseFx) * tw * 0.6 + jitter;
  S.tree.y = S.groundY + th * 0.012 - th;
  S.tree.baseX = S.tree.x + TREE.baseFx * tw;
  S.k = th / 600;
}

// 视差偏移，depth 0（无穷远）~ 1（最近）
export const parX = (depth) => S.par.x * depth * 7 * S.k;
export const parY = (depth) => S.par.y * depth * 4 * S.k;
