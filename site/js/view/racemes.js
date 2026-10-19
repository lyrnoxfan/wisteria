// 花串：每串是一根 8 节的软链（Verlet），挂在真实枝条下沿的悬挂点上。
// 受重力、风场（含湍流）、手指推开；顶端跟着树一起摆。
// 三层景深：后排（雾色、偏小）画在树后，中排、前排画在树前。
import { S, parX, parY } from './stage.js';
import { TREE } from '../data/tree.js';
import { treePoint } from './tree.js';
import { Rng, clamp, rgba, makeCanvas, noise1, easeOut, smoothstep, R } from '../lib/util.js';

const N = 8;
const DEPTH = [0.5, 0.65, 0.78];
export const layers = [[], [], []];
let sprites = [];
let images = [];
let glowColor = [170, 130, 255];
let weights = [1];
let tintKey = '';
let brushHandler = null;
const tmp = { x: 0, y: 0 };

export function initRacemes(imgs, cultivar, onBrush) {
  images = imgs;
  glowColor = cultivar.glow;
  weights = cultivar.weights;
  brushHandler = onBrush;
}

function makeGlow(img) {
  const gh = 150;
  const gw = Math.max(8, Math.round((gh * img.width) / img.height));
  const pad = 20;
  const c = makeCanvas(gw + pad * 2, gh + pad * 2);
  const g = c.ctx;
  g.shadowColor = rgba(glowColor, 1);
  g.shadowBlur = 16;
  g.shadowOffsetX = 5000;
  g.drawImage(img, pad - 5000, pad, gw, gh);
  return { c, padY: pad / gh, padX: pad / gw };
}

export function layoutRacemes(seed) {
  const maxLen = S.tree.h * 0.44;
  const hc = Math.min(1000, Math.max(64, Math.round(maxLen * S.dpr)));
  sprites = images.map((img) => {
    const aspect = img.width / img.height;
    const w = Math.max(4, Math.round(hc * aspect));
    const base = makeCanvas(w, hc);
    base.ctx.imageSmoothingQuality = 'high';
    base.ctx.drawImage(img, 0, 0, w, hc);
    return { aspect, base, tint: makeCanvas(w, hc), haze: makeCanvas(w, hc), glow: makeGlow(img) };
  });
  tintKey = '';

  const r = new Rng(seed ^ 0x9e3779b9);
  const T = S.tree;
  const want = clamp(Math.round(T.w / 4.6), 64, 124);
  const minD = T.w * 0.024;
  const pool = TREE.anchors.map(([fx, fy, o]) => {
    const w = 0.6 + o * 0.7 - (fy < 0.1 ? 0.2 : 0);
    return { fx, fy, o, key: Math.pow(r.next(), 1 / Math.max(0.05, w)) };
  });
  pool.sort((a, b) => b.key - a.key);
  const chosen = [];
  for (const p of pool) {
    if (chosen.length >= want) break;
    const x = p.fx * T.w, y = p.fy * T.h;
    let ok = true;
    for (const c of chosen) {
      const dx = c.fx * T.w - x, dy = (c.fy * T.h - y) * 1.6;
      if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
    }
    if (ok) chosen.push(p);
  }

  for (const L of layers) L.length = 0;
  for (const p of chosen) {
    const pBack = 0.46 - p.o * 0.26;
    const v = r.next();
    const layer = v < pBack ? 0 : v < pBack + 0.42 ? 1 : 2;
    let lenF = 0.11 + 0.19 * Math.pow(r.next(), 1.5) + (r.chance(0.14) ? r.range(0.05, 0.12) : 0);
    lenF *= [0.82, 1, 1.08][layer];
    const len = T.h * Math.min(0.44, lenF);
    const sp = r.weighted(weights.slice(0, sprites.length));
    const rc = {
      fx: p.fx,
      fy: p.fy,
      layer,
      len,
      w: len * sprites[sp].aspect * r.range(0.78, 0.95),
      sp,
      alpha: [0.8, 0.96, 1][layer],
      x: new Float32Array(N + 1),
      y: new Float32Array(N + 1),
      px: new Float32Array(N + 1),
      py: new Float32Array(N + 1),
      seed: r.range(0, 500),
      stiff: r.range(0.85, 1.15),
      appear: 0,
      grow: 0,
      fade: 0,
      touch: 0,
      cool: 0,
      lit: 0,
    };
    treePoint(p.fx, p.fy, tmp, DEPTH[layer]);
    for (let i = 0; i <= N; i++) {
      rc.x[i] = rc.px[i] = tmp.x;
      rc.y[i] = rc.py[i] = tmp.y + (len / N) * i;
    }
    const bottom = tmp.y + len;
    rc.lit = 0.45 + 0.55 * smoothstep(T.y + T.h * 0.25, S.groundY, bottom);
    // 入场：树的生长前沿经过悬挂点后再垂下来
    rc.appearV = (1 - p.fy) / 1.18;
    rc.appearJ = r.range(0.05, 0.9);
    layers[layer].push(rc);
  }
  // 前排、中排按悬挂高度排序，近处更低的画在后面
  for (const L of layers) L.sort((a, b) => a.fy - b.fy);
}

export function tintRacemes(pal) {
  const k = [pal.flower, pal.haze].map((c) => c.map((v) => v | 0).join(',')).join('|') + pal.flowerA.toFixed(2) + pal.hazeA.toFixed(2);
  if (k === tintKey) return;
  tintKey = k;
  for (const s of sprites) {
    for (const [dst, extra] of [[s.tint, null], [s.haze, pal.haze]]) {
      const g = dst.ctx;
      g.globalCompositeOperation = 'copy';
      g.drawImage(s.base, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      if (pal.flowerA > 0.004) {
        g.fillStyle = rgba(pal.flower, pal.flowerA);
        g.fillRect(0, 0, dst.width, dst.height);
      }
      if (extra) {
        g.fillStyle = rgba(extra, 0.3 + pal.hazeA * 0.25);
        g.fillRect(0, 0, dst.width, dst.height);
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
}

export function updateRacemes(dt, wind, pointers) {
  const t = S.t;
  const g = 1000 * S.k;
  const dmp = Math.exp(-1.5 * dt);
  const dt2 = dt * dt;
  const revealT = S.revealT0;
  for (let l = 0; l < 3; l++) {
    const depth = DEPTH[l];
    for (const r of layers[l]) {
      // 入场
      const at = revealT + S.revealDur * r.appearV + r.appearJ;
      const since = t - at;
      r.grow = since <= 0 ? 0 : easeOut(clamp(since / 1.4, 0, 1));
      r.fade = clamp(since / 0.5, 0, 1);

      treePoint(r.fx, r.fy, tmp, depth);
      r.x[0] = tmp.x;
      r.y[0] = tmp.y;
      const L = r.len / N;
      for (let i = 1; i <= N; i++) {
        const x = r.x[i], y = r.y[i];
        const vx = (x - r.px[i]) * dmp, vy = (y - r.py[i]) * dmp;
        r.px[i] = x;
        r.py[i] = y;
        const f = i / N;
        const w = wind.at(x, t) * (0.45 + 0.55 * f);
        const turb = noise1(t * 0.85 + r.seed + i * 0.11) * (0.035 + wind.level * 0.09);
        r.x[i] = x + vx + (w + turb) * g * 0.4 * dt2;
        r.y[i] = y + vy + g * dt2;
      }
      // 手指 / 鼠标拨开
      if (pointers.size) {
        for (const p of pointers.values()) {
          const rad = (p.down ? 44 : p.mouse ? 24 : 0) * S.k + (p.down ? 10 : 6);
          if (rad <= 6) continue;
          if (p.x < r.x[0] - r.len * 0.8 - rad || p.x > r.x[0] + r.len * 0.8 + rad || p.y < r.y[0] - rad || p.y > r.y[0] + r.len + rad) continue;
          const sp = Math.min(2500, Math.hypot(p.vx, p.vy));
          for (let i = 1; i <= N; i++) {
            const dx = r.x[i] - p.x, dy = r.y[i] - p.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > rad * rad) continue;
            const d = Math.sqrt(d2) || 0.001;
            const push = (rad - d) / rad;
            r.x[i] += (dx / d) * (rad - d) * 0.45 + p.vx * dt * push * 0.55;
            r.y[i] += (dy / d) * (rad - d) * 0.18 + p.vy * dt * push * 0.25;
            r.touch += push * (0.15 + sp / 900) * dt * 60;
          }
        }
      }
      // 约束：节长 + 抗弯
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i <= N; i++) {
          const dx = r.x[i] - r.x[i - 1], dy = r.y[i] - r.y[i - 1];
          const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const diff = (d - L) / d;
          if (i === 1) {
            r.x[1] -= dx * diff;
            r.y[1] -= dy * diff;
          } else {
            r.x[i - 1] += dx * diff * 0.5;
            r.y[i - 1] += dy * diff * 0.5;
            r.x[i] -= dx * diff * 0.5;
            r.y[i] -= dy * diff * 0.5;
          }
        }
        const minD = 2 * L * (0.955 - 0.03 * r.stiff);
        for (let i = 1; i < N; i++) {
          const dx = r.x[i + 1] - r.x[i - 1], dy = r.y[i + 1] - r.y[i - 1];
          const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          if (d < minD) {
            const c = ((minD - d) / d) * 0.25;
            if (i > 1) {
              r.x[i - 1] -= dx * c;
              r.y[i - 1] -= dy * c;
            }
            r.x[i + 1] += dx * c;
            r.y[i + 1] += dy * c;
          }
        }
      }
      // 拨动反馈：飘瓣 + 沙沙声
      r.cool -= dt;
      r.touch *= Math.exp(-4 * dt);
      if (r.touch > 1.2 && r.cool <= 0 && brushHandler) {
        const i = 2 + Math.floor(Math.random() * (N - 2));
        brushHandler(r.x[i], r.y[i], Math.min(1, r.touch / 6), r);
        r.touch *= 0.35;
        r.cool = 0.16;
      }
    }
  }
}

// 鸟啄一下、风推一下：给附近的花串一点位移
export function poke(x, y, rad, ix, iy) {
  for (let l = 1; l < 3; l++) {
    for (const r of layers[l]) {
      if (Math.abs(r.x[0] - x) > rad + r.len * 0.6) continue;
      for (let i = 1; i <= N; i++) {
        const dx = r.x[i] - x, dy = r.y[i] - y;
        if (dx * dx + dy * dy < rad * rad) {
          r.px[i] -= ix;
          r.py[i] -= iy;
        }
      }
    }
  }
}

// 随机取一串已长出的花上的一点（掉花瓣用）
export function randomBloomPoint(out) {
  const l = Math.random() < 0.25 ? 0 : Math.random() < 0.5 ? 1 : 2;
  const L = layers[l];
  if (!L.length) return null;
  const r = L[Math.floor(Math.random() * L.length)];
  if (r.grow < 0.95) return null;
  const i = 2 + Math.floor(Math.random() * (N - 1));
  out.x = r.x[i] + R(-0.4, 0.4) * r.w;
  out.y = r.y[i];
  out.layer = l;
  return out;
}

export function drawRacemes(ctx, layer, pal) {
  const d = S.dpr;
  const L = layers[layer];
  for (const r of L) {
    if (r.grow <= 0.001) continue;
    const s = sprites[r.sp];
    const src = layer === 0 ? s.haze : s.tint;
    const sw = src.width, shTot = src.height;
    const sh = shTot / N;
    const segs = r.grow * N;
    const nSeg = Math.ceil(segs);
    ctx.globalAlpha = r.alpha * r.fade;
    for (let i = 0; i < nSeg; i++) {
      const x0 = r.x[i], y0 = r.y[i];
      const dx = r.x[i + 1] - x0, dy = r.y[i + 1] - y0;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const ux = dx / len, uy = dy / len;
      const frac = Math.min(1, segs - i);
      const sy = i * sh;
      const srcH = Math.min(sh * frac * 1.12, shTot - sy);
      if (srcH < 0.5) continue;
      const dstH = (len * srcH) / sh;
      ctx.setTransform(uy * d, -ux * d, ux * d, uy * d, x0 * d, y0 * d);
      ctx.drawImage(src, 0, sy, sw, srcH, -r.w / 2, 0, r.w, dstH);
    }
  }
  ctx.globalAlpha = 1;
}

// 夜里：花被地灯照亮，泛出柔光
export function drawRacemeGlow(ctx, pal) {
  const a0 = pal.lightUp;
  if (a0 < 0.02) return;
  const d = S.dpr;
  ctx.globalCompositeOperation = 'lighter';
  for (let l = 0; l < 3; l++) {
    for (const r of layers[l]) {
      if (r.grow <= 0.05) continue;
      const g = sprites[r.sp].glow;
      const x0 = r.x[0], y0 = r.y[0];
      const dx = r.x[N] - x0, dy = r.y[N] - y0;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const ux = dx / len, uy = dy / len;
      const h = len;
      const w = r.w;
      ctx.globalAlpha = a0 * r.lit * r.fade * (l === 0 ? 0.2 : 0.3);
      ctx.setTransform(uy * d, -ux * d, ux * d, uy * d, x0 * d, y0 * d);
      ctx.drawImage(g.c, -w / 2 - w * g.padX, -h * g.padY, w * (1 + 2 * g.padX), h * (1 + 2 * g.padY));
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
