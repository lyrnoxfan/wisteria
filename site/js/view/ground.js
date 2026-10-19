// 地面：一抹淡墨地面与几丛草（缓存），树影 + 随风晃动的光斑，夜里树下的地灯光晕
import { S, parX } from './stage.js';
import { swayAt } from './tree.js';
import { TAU, Rng, R, clamp, rgba, mix, makeCanvas } from '../lib/util.js';

const DEPTH = 0.6;
let layer = null;
let layerKey = '';
let blob = null; // 柔边圆形，用来画影子/光
let dapples = [];
let tufts = [];
let strokes = [];
let glowCol = [180, 140, 255];

export function initGround(cultivar) {
  glowCol = cultivar.glow;
}

function makeBlob() {
  const c = makeCanvas(128, 128);
  const g = c.ctx;
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function layoutGround(seed) {
  if (!blob) blob = makeBlob();
  const r = new Rng(seed ^ 0x6d2b);
  const T = S.tree;
  dapples = [];
  for (let i = 0; i < 16; i++) {
    const a = r.range(0, TAU), rr = Math.sqrt(r.next());
    dapples.push({ x: Math.cos(a) * rr * 0.42, y: Math.sin(a) * rr, s: r.range(0.5, 1.3), ph: r.range(0, TAU), f: r.range(0.6, 1.6) });
  }
  tufts = [];
  const nt = r.int(7, 12);
  for (let i = 0; i < nt; i++) {
    const near = r.chance(0.55);
    const x = near ? T.baseX + r.range(-0.26, 0.26) * T.w : r.range(0.04, 0.96) * S.W;
    const blades = [];
    const nb = r.int(3, 7);
    for (let b = 0; b < nb; b++) blades.push({ dx: r.range(-3, 3), h: r.range(5, 15), lean: r.range(-0.6, 0.6), w: r.range(0.5, 1.1) });
    tufts.push({ x, y: S.groundY + r.range(-1, 9) * S.k, blades, ph: r.range(0, TAU) });
  }
  strokes = [];
  for (let i = 0; i < 16; i++) {
    const cx = T.baseX + r.range(-0.6, 0.6) * Math.max(S.W * 0.5, T.w * 0.9);
    strokes.push({ x: cx, y: S.groundY + r.range(-2, 22) * S.k, l: r.range(0.06, 0.3) * S.W, a: r.range(0.025, 0.07), w: r.range(0.5, 1.6) * S.k, wob: r.range(0, 100) });
  }
  layerKey = '';
  layer = makeCanvas(S.W * S.dpr, Math.max(4, (S.H - S.groundY + 50 * S.k)) * S.dpr);
}

function renderLayer(pal) {
  const k = (pal.dark * 20).toFixed(0) + (pal.shadow * 10).toFixed(0);
  if (k === layerKey) return;
  layerKey = k;
  const g = layer.ctx;
  const y0 = S.groundY - 50 * S.k;
  g.setTransform(S.dpr, 0, 0, S.dpr, 0, -y0 * S.dpr);
  g.clearRect(0, y0, S.W, S.H);
  const ink = mix([92, 84, 72], [150, 160, 200], pal.dark);
  const T = S.tree;
  // 地面的一抹淡墨
  const rx = Math.max(S.W * 0.62, T.w * 1.25);
  g.save();
  g.translate(T.baseX, S.groundY + 8 * S.k);
  g.scale(rx, 30 * S.k);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  rg.addColorStop(0, rgba(ink, 0.085 + pal.dark * 0.05));
  rg.addColorStop(0.6, rgba(ink, 0.04));
  rg.addColorStop(1, rgba(ink, 0));
  g.fillStyle = rg;
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.fill();
  g.restore();
  // 干笔横皴
  g.lineCap = 'round';
  for (const s of strokes) {
    g.strokeStyle = rgba(ink, s.a * (1 + pal.dark * 0.5));
    g.lineWidth = s.w;
    g.beginPath();
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const x = s.x - s.l / 2 + (s.l * i) / n;
      const y = s.y + Math.sin(s.wob + i * 1.3) * 0.8 * S.k;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
}

export function drawGround(ctx, pal, t, wind) {
  renderLayer(pal);
  const d = S.dpr;
  const T = S.tree;
  const ox = parX(DEPTH);
  ctx.setTransform(1, 0, 0, 1, ox * d, (S.groundY - 50 * S.k) * d);
  ctx.globalAlpha = 1;
  ctx.drawImage(layer, 0, 0);

  ctx.setTransform(d, 0, 0, d, ox * d, 0);
  // 草：风吹时轻摇
  const grass = mix([104, 116, 84], [40, 48, 66], pal.dark);
  ctx.strokeStyle = rgba(grass, 0.5);
  ctx.lineCap = 'round';
  for (const tf of tufts) {
    const w = wind.at(tf.x, t);
    for (const b of tf.blades) {
      const h = b.h * S.k;
      const bend = (b.lean + w * 1.1 + Math.sin(t * 2.2 + tf.ph + b.dx) * 0.08) * h * 0.6;
      ctx.lineWidth = b.w * S.k;
      ctx.beginPath();
      const x = tf.x + b.dx * S.k;
      ctx.moveTo(x, tf.y);
      ctx.quadraticCurveTo(x + bend * 0.3, tf.y - h * 0.6, x + bend, tf.y - h);
      ctx.stroke();
    }
  }

  // 树影：午间在树下，傍晚被拉长偏向一侧
  const sh = pal.shadow;
  if (sh > 0.02) {
    const side = pal.sun > 0.05 ? (pal.sunX < 0.5 ? 1 : -1) : 0;
    const stretch = 1 + pal.sun * 0.9;
    const cx = T.baseX + side * T.w * 0.22 * pal.sun + swayAt(T.y + T.h * 0.3) * 0.4;
    const rx = T.w * 0.5 * stretch, ry = 12 * S.k;
    const shadow = blobOf([40, 34, 30]);
    ctx.globalAlpha = 0.16 * sh;
    ctx.drawImage(shadow, cx - rx, S.groundY + 6 * S.k - ry, rx * 2, ry * 2);
    ctx.globalAlpha = 0.22 * sh;
    ctx.drawImage(shadow, T.baseX - T.w * 0.14, S.groundY + 2 * S.k - 5 * S.k, T.w * 0.28, 12 * S.k);
    // 光斑：叶隙漏下的光，随树冠摆动闪烁
    if (pal.dapple > 0.02) {
      const light = blobOf(mix(pal.sky0, [255, 250, 235], 0.5).map((v) => Math.round(v / 4) * 4));
      const sway = swayAt(T.y + T.h * 0.2) * 1.4;
      for (const p of dapples) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.f + p.ph + sway * 0.05);
        ctx.globalAlpha = 0.32 * pal.dapple * sh * tw;
        const px = cx + p.x * rx * 2 + sway * (0.6 + p.s * 0.3);
        const py = S.groundY + 6 * S.k + p.y * ry * 0.7;
        const s = p.s * 9 * S.k;
        ctx.drawImage(light, px - s, py - s * 0.35, s * 2, s * 0.7);
      }
    }
  }

  // 夜：树下几盏地灯
  const lu = pal.lightUp;
  if (lu > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = lu * 0.33;
    ctx.drawImage(blobOf(glowCol), T.baseX - T.w * 0.55, S.groundY - 12 * S.k, T.w * 1.1, 34 * S.k);
    const warm = blobOf([255, 214, 180]);
    ctx.globalAlpha = lu * 0.2;
    ctx.drawImage(warm, T.baseX - T.w * 0.16, S.groundY - T.h * 0.42, T.w * 0.32, T.h * 0.48);
    ctx.globalAlpha = lu * 0.45;
    for (const f of [-0.2, 0.04, 0.24]) {
      ctx.drawImage(warm, T.baseX + f * T.w - 9 * S.k, S.groundY - 3 * S.k, 18 * S.k, 8 * S.k);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// 按颜色缓存的柔边圆
const blobs = new Map();
function blobOf(col) {
  const k = col.map((v) => v | 0).join(',');
  let c = blobs.get(k);
  if (c) return c;
  if (blobs.size > 16) blobs.clear();
  c = makeCanvas(128, 128);
  const g = c.ctx;
  g.drawImage(blob, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = rgba(col);
  g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'source-over';
  blobs.set(k, c);
  return c;
}
