// 行人：Muse 从一侧走来，在花下慢慢停住、抬头看一会儿，再继续走出画面。
// 走/看两张姿势图之间交叉淡化；脚下有影子，脚步有声音，会踢起地上的花瓣。
import { S, parX } from './stage.js';
import { kick } from './petals.js';
import { R, chance, clamp, rgba, makeCanvas, damp } from '../lib/util.js';
import * as V from '../audio/voices.js';

const walkers = [];
let imgWalk = null, imgLook = null;
let cWalk = null, cLook = null, tintKey = '';

export function initWalkers(walk, look) {
  imgWalk = walk;
  imgLook = look;
}

function scaled(img, h) {
  const c = makeCanvas(Math.max(2, Math.round((h * img.width) / img.height)), Math.max(2, Math.round(h)));
  c.ctx.imageSmoothingQuality = 'high';
  c.ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function layoutWalkers() {
  const h = S.tree.h * 0.2 * S.dpr;
  cWalk = { base: scaled(imgWalk, h), tint: null };
  cLook = { base: scaled(imgLook, h), tint: null };
  cWalk.tint = makeCanvas(cWalk.base.width, cWalk.base.height);
  cLook.tint = makeCanvas(cLook.base.width, cLook.base.height);
  tintKey = '';
  walkers.length = 0;
}

export function tintWalkers(pal) {
  const k = pal.ink.map((v) => v | 0).join(',') + (pal.inkA * 100).toFixed(0);
  if (k === tintKey) return;
  tintKey = k;
  for (const c of [cWalk, cLook]) {
    const g = c.tint.ctx;
    g.globalCompositeOperation = 'copy';
    g.drawImage(c.base, 0, 0);
    if (pal.inkA > 0.004) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = rgba(pal.ink, pal.inkA * 0.75);
      g.fillRect(0, 0, c.tint.width, c.tint.height);
    }
    g.globalCompositeOperation = 'source-over';
  }
}

export function spawnWalker() {
  if (walkers.length >= 1) return false;
  const dir = chance(0.5) ? 1 : -1;
  const T = S.tree;
  const h = T.h * R(0.17, 0.19);
  const stopX = T.baseX - dir * R(0.06, 0.3) * T.w;
  walkers.push({
    dir, h,
    x: dir > 0 ? -h * 0.4 : S.W + h * 0.4,
    y: S.groundY + R(2, 9) * S.k,
    v: 0, vMax: h * R(0.36, 0.44), // 每秒走约 0.4 个身高
    state: 'walk', stopX, look: 0, wait: R(5, 10), step: 0, stepSide: 0,
    stops: chance(0.85),
  });
  return true;
}

export function walkerNear(x, rad) {
  for (const w of walkers) if (Math.abs(w.x - x) < rad) return true;
  return false;
}

export function updateWalkers(dt) {
  for (let i = walkers.length - 1; i >= 0; i--) {
    const w = walkers[i];
    let target = w.vMax;
    if (w.state === 'walk' && w.stops) {
      const dist = (w.stopX - w.x) * w.dir;
      if (dist < w.h * 0.9) target = w.vMax * clamp(dist / (w.h * 0.9), 0, 1);
      if (dist <= 2) {
        w.state = 'look';
        w.v = 0;
      }
    }
    if (w.state === 'look') {
      target = 0;
      w.look = damp(w.look, 1, 5, dt);
      w.wait -= dt;
      if (w.wait <= 0) w.state = 'go';
    } else {
      w.look = damp(w.look, 0, 6, dt);
    }
    if (w.state === 'go' && w.look > 0.2) target = 0;
    w.v = damp(w.v, target, 2.2, dt);
    w.x += w.dir * w.v * dt;
    // 步频与速度同步
    const moving = w.v / w.vMax;
    if (moving > 0.08 && w.look < 0.3) {
      w.step += (dt * w.v) / (w.h * 0.36);
      if (w.step >= 1) {
        w.step -= 1;
        w.stepSide ^= 1;
        V.step(clamp((w.x / S.W) * 2 - 1, -0.9, 0.9), moving);
        kick(w.x + w.dir * w.h * 0.08, w.dir * w.v);
      }
    }
    if ((w.dir > 0 && w.x > S.W + w.h * 0.6) || (w.dir < 0 && w.x < -w.h * 0.6)) walkers.splice(i, 1);
  }
}

export function drawWalkers(ctx, pal) {
  const d = S.dpr;
  for (const w of walkers) {
    const ox = parX(0.62);
    const moving = w.v / w.vMax;
    const bob = Math.abs(Math.sin(w.step * Math.PI)) * w.h * 0.008 * moving;
    // 影子
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 0.1 + pal.shadow * 0.12;
    ctx.fillStyle = 'rgb(40,34,30)';
    ctx.beginPath();
    ctx.ellipse(w.x + ox, w.y - 1, w.h * 0.13, w.h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [c, a] of [[cWalk, 1 - w.look], [cLook, w.look]]) {
      if (a < 0.02) continue;
      const img = c.tint;
      const hh = w.h;
      const ww = (hh * img.width) / img.height;
      ctx.globalAlpha = a;
      // 素材朝右；向左走时水平翻转
      ctx.setTransform(d * w.dir, 0, 0, d, (w.x + ox) * d, 0);
      ctx.drawImage(img, -ww / 2, w.y - hh - bob, ww, hh);
    }
  }
  ctx.globalAlpha = 1;
}
