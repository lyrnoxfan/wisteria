// 鸟：
//   绣眼（メジロ）— 波浪式飞来，落在真实枝条上沿，跳枝、啄花（花串会晃）、鸣叫，被手指惊飞
//   燕子 — 快速掠过，忽高忽低，扇几下翅再滑翔
//   远处鸟群 — 天边一串小墨点
//   归鸦 — 傍晚三两只慢慢飞过，偶尔"啊"一声
//   麻雀 — 落在树下地面跳来跳去、啄地，行人走近或被触碰就飞走
import { S, parX, parY } from './stage.js';
import { TREE } from '../data/tree.js';
import { treePoint } from './tree.js';
import { poke } from './racemes.js';
import { spawnPetal } from './petals.js';
import { walkerNear } from './walkers.js';
import { TAU, R, chance, clamp, lerp, smooth, pick } from '../lib/util.js';
import * as V from '../audio/voices.js';

const flyers = [];
const mejiro = [];
const sparrows = [];
const tmp = { x: 0, y: 0 };
const pan = (x) => clamp((x / S.W) * 2 - 1, -0.9, 0.9);

export function resetBirds() {
  flyers.length = 0;
  mejiro.length = 0;
  sparrows.length = 0;
}
export const birdCount = () => flyers.length + mejiro.length + sparrows.length;

// ───────────── 生成 ─────────────
export function spawnSwallows(n = 1) {
  const dir = chance(0.5) ? 1 : -1;
  const y0 = S.H * R(0.16, 0.6);
  for (let i = 0; i < n; i++) {
    const near = chance(0.65);
    flyers.push({
      kind: 'swallow', dir, near,
      x: dir > 0 ? -50 - i * R(40, 110) : S.W + 50 + i * R(40, 110),
      y0: y0 + R(-50, 50) * S.k, y: y0,
      v: (S.W * R(0.28, 0.42) + 170 * S.k) * (near ? 1 : 0.7),
      amp: R(25, 75) * S.k, w: R(0.5, 1.1), ph: R(0, TAU),
      s: R(21, 26) * S.k * (near ? 1 : 0.6),
      fp: R(0, TAU), flapping: true, ft: R(0.25, 0.5),
      dive: chance(0.45) ? R(0.3, 0.7) : -1, called: false, t: 0, prevY: y0,
    });
  }
}

export function spawnFlock(kind = 'far') {
  const dir = chance(0.5) ? 1 : -1;
  const crow = kind === 'crow';
  const n = crow ? Math.floor(R(2, 5.99)) : Math.floor(R(5, 11.99));
  const y0 = S.H * (crow ? R(0.07, 0.3) : R(0.05, 0.26));
  const v = (crow ? S.W * R(0.07, 0.1) + 28 * S.k : S.W * R(0.05, 0.085) + 18 * S.k);
  const lead = dir > 0 ? -30 : S.W + 30;
  const members = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const rank = Math.ceil(i / 2);
    members.push({
      dx: -dir * rank * R(10, 20) * S.k * (crow ? 2.2 : 1) - (crow ? R(0, 60) * S.k : 0),
      dy: side * rank * R(4, 9) * S.k * (crow ? 2 : 1) + R(-4, 4) * S.k,
      fp: R(0, TAU), fr: crow ? R(3.2, 4) : R(6, 8.5),
      s: crow ? R(13, 17) * S.k : R(3.2, 5) * S.k,
      wob: R(0, TAU),
    });
  }
  flyers.push({ kind: crow ? 'crows' : 'flock', dir, x: lead, y0, v, members, t: 0, nextCall: R(0.8, 2.5), calls: 0 });
}

function freePerch() {
  const used = new Set(mejiro.map((m) => m.perch));
  const opts = [];
  TREE.perches.forEach((p, i) => { if (!used.has(i)) opts.push(i); });
  return opts.length ? pick(opts) : -1;
}

export function spawnMejiro(n = 1) {
  const side = chance(0.5) ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const perch = freePerch();
    if (perch < 0) return;
    const sx = side < 0 ? -30 : S.W + 30;
    const sy = S.H * R(0.06, 0.38);
    mejiro.push({
      state: 'in', perch, x: sx, y: sy, sx, sy, tx: 0, ty: 0,
      t: -i * R(0.5, 1.4), dur: R(2, 2.8),
      face: side < 0 ? 1 : -1, s: R(24, 27) * S.k,
      head: 0, headT: 0, crouch: 0, tail: 0, fp: R(0, TAU), flap: 0,
      act: 'idle', actT: R(0.6, 1.4), stay: R(10, 24), hop: null, called: false,
    });
  }
}

export function spawnSparrows(n = 2) {
  const side = chance(0.5) ? -1 : 1;
  const gx = clamp(S.tree.baseX + R(-0.55, 0.55) * S.tree.w, S.W * 0.08, S.W * 0.92);
  for (let i = 0; i < n; i++) {
    const sx = side < 0 ? -20 : S.W + 20;
    const sy = S.groundY - R(70, 150) * S.k;
    sparrows.push({
      state: 'in', x: sx, y: sy, sx, sy,
      tx: clamp(gx + R(-40, 40) * S.k, 10, S.W - 10), ty: S.groundY + R(-2, 12) * S.k,
      t: -i * R(0.25, 0.7), dur: R(1.1, 1.6),
      face: side < 0 ? 1 : -1, s: R(16, 19) * S.k,
      head: 0, act: 'look', actT: R(0.5, 1.2), stay: R(12, 28), hopH: 0, hopFrom: 0, hopTo: 0, hopT: 0, hops: 0,
      fp: R(0, TAU),
    });
  }
}

// ───────────── 更新 ─────────────
function pointerNear(pointers, x, y, rad) {
  for (const p of pointers.values()) {
    const fast = Math.hypot(p.vx, p.vy) > 700;
    if (!p.down && !(p.mouse && fast)) continue;
    if ((p.x - x) ** 2 + (p.y - y) ** 2 < rad * rad) return true;
  }
  return false;
}

function bezier(a, c, b, u) {
  const v = 1 - u;
  return v * v * a + 2 * v * u * c + u * u * b;
}

function updateMejiro(m, dt, wind, pointers) {
  m.t += dt;
  if (m.t < 0) return true;
  const P = TREE.perches[m.perch];
  treePoint(P[0], P[1], tmp, 0.65);
  if (m.state === 'in' || m.state === 'out') {
    const u = clamp(m.t / m.dur, 0, 1);
    const e = m.state === 'in' ? 1 - (1 - u) * (1 - u) : u * u;
    const ex = m.state === 'in' ? tmp.x : m.tx, ey = m.state === 'in' ? tmp.y : m.ty;
    const cx = (m.sx + ex) / 2, cy = Math.min(m.sy, ey) - 70 * S.k;
    const nx = bezier(m.sx, cx, ex, e), ny = bezier(m.sy, cy, ey, e);
    if (Math.abs(nx - m.x) > 0.05) m.face = nx > m.x ? 1 : -1;
    // 波浪式飞行：扑翅一阵、收翅一阵
    const cyc = (m.t * 2.4) % 1;
    const flapping = cyc < 0.62 || (m.state === 'in' && u > 0.82);
    m.fp += dt * (flapping ? 30 : 0);
    m.flap = flapping ? Math.sin(m.fp) : 0.12;
    const bob = (m.state === 'in' && u > 0.85 ? 0 : 1) * Math.sin(cyc * TAU) * 4 * S.k;
    m.x = nx;
    m.y = ny + bob;
    if (m.state === 'in' && u >= 1) {
      m.state = 'perch';
      m.t = 0;
      V.mejiro(pan(m.x), 2);
    }
    if (m.state === 'out' && u >= 1) return false;
    return true;
  }
  // 停在枝头
  m.stay -= dt;
  m.actT -= dt;
  let ox = 0, oy = 0;
  if (m.hop) {
    m.hop.t += dt;
    const u = clamp(m.hop.t / 0.32, 0, 1);
    const Q = TREE.perches[m.hop.from];
    const a = treePoint(Q[0], Q[1], { x: 0, y: 0 }, 0.65);
    ox = lerp(a.x, tmp.x, smooth(u)) - tmp.x;
    oy = lerp(a.y, tmp.y, smooth(u)) - tmp.y - Math.sin(u * Math.PI) * 9 * S.k;
    m.crouch = u < 0.15 ? 1 - u / 0.15 : 0;
    if (u >= 1) m.hop = null;
  }
  m.x = tmp.x + ox;
  m.y = tmp.y + oy;
  m.flap = 0;
  // 头：时不时转一下
  m.headT -= dt;
  if (m.act !== 'peck' && m.headT <= 0) {
    m.headTarget = R(-0.35, 0.25);
    m.headT = R(0.4, 1.6);
  }
  if (m.act === 'peck') {
    const k = (m.actDur - m.actT) / m.actDur;
    const dip = Math.max(0, Math.sin(k * Math.PI * 3));
    m.head = 0.95 * dip;
    if (dip > 0.95 && !m.pecked) {
      m.pecked = true;
      poke(m.x + m.face * 10 * S.k, m.y + 14 * S.k, 26 * S.k, m.face * 1.2 * S.k, -0.6 * S.k);
      if (chance(0.25)) spawnPetal(m.x + m.face * 8 * S.k, m.y + 8 * S.k);
    }
    if (dip < 0.3) m.pecked = false;
  } else {
    m.head += ((m.headTarget || 0) - m.head) * Math.min(1, dt * 10);
  }
  m.tail = Math.max(0, m.tail - dt * 4);
  if (m.actT <= 0 && !m.hop) {
    const roll = Math.random();
    if (roll < 0.28) {
      m.act = 'peck'; m.actDur = m.actT = R(0.8, 1.2);
    } else if (roll < 0.45) {
      // 跳到附近另一根枝
      const here = TREE.perches[m.perch];
      const near = [];
      TREE.perches.forEach((p, i) => {
        if (i === m.perch || mejiro.some((o) => o.perch === i)) return;
        const dx = (p[0] - here[0]) * S.tree.w, dy = (p[1] - here[1]) * S.tree.h;
        if (dx * dx + dy * dy < (S.tree.w * 0.13) ** 2) near.push(i);
      });
      if (near.length) {
        const to = pick(near);
        const tp = TREE.perches[to];
        m.face = tp[0] > here[0] ? 1 : -1;
        m.hop = { from: m.perch, t: 0 };
        m.perch = to;
      } else m.face *= -1;
      m.act = 'idle'; m.actT = R(0.6, 1.2);
    } else if (roll < 0.6) {
      m.face *= -1; m.tail = 1; m.act = 'idle'; m.actT = R(0.5, 1.3);
    } else if (roll < 0.74) {
      V.mejiro(pan(m.x), Math.floor(R(1, 4)));
      m.tail = 1; m.act = 'idle'; m.actT = R(0.8, 1.6);
    } else if (roll < 0.8) {
      V.mejiroSong(pan(m.x));
      m.act = 'idle'; m.actT = R(1.5, 2.5);
    } else {
      m.act = 'idle'; m.actT = R(0.7, 2);
    }
  }
  const startled = pointerNear(pointers, m.x, m.y - 8 * S.k, 70 * S.k) || (wind.level > 0.95 && chance(dt * 0.5));
  if (m.stay <= 0 || startled) {
    m.state = 'out';
    m.t = 0;
    m.dur = startled ? R(1.1, 1.5) : R(1.6, 2.4);
    m.sx = m.x; m.sy = m.y;
    const side = startled ? (m.x < S.W / 2 ? -1 : 1) : (chance(0.5) ? -1 : 1);
    m.tx = side < 0 ? -40 : S.W + 40;
    m.ty = S.H * R(0.02, 0.3);
    m.face = side < 0 ? -1 : 1;
    V.flutter(pan(m.x));
    if (startled) V.mejiro(pan(m.x), 2);
  }
  return true;
}

function updateSparrow(b, dt, pointers) {
  b.t += dt;
  if (b.t < 0) return true;
  if (b.state === 'in' || b.state === 'out') {
    const u = clamp(b.t / b.dur, 0, 1);
    const e = b.state === 'in' ? 1 - (1 - u) * (1 - u) : u * u;
    const cx = (b.sx + b.tx) / 2, cy = Math.min(b.sy, b.ty) - 30 * S.k;
    const nx = bezier(b.sx, cx, b.tx, e), ny = bezier(b.sy, cy, b.ty, e);
    if (Math.abs(nx - b.x) > 0.05) b.face = nx > b.x ? 1 : -1;
    b.x = nx; b.y = ny;
    b.fp += dt * 34;
    if (b.state === 'in' && u >= 1) {
      b.state = 'ground'; b.t = 0;
      if (chance(0.6)) V.sparrow(pan(b.x));
    }
    if (b.state === 'out' && u >= 1) return false;
    return true;
  }
  b.stay -= dt;
  b.actT -= dt;
  if (b.act === 'hop') {
    b.hopT += dt;
    const u = clamp(b.hopT / 0.2, 0, 1);
    b.x = lerp(b.hopFrom, b.hopTo, u);
    b.hopH = Math.sin(u * Math.PI) * 5 * S.k;
    if (u >= 1) {
      b.hops--;
      b.hopH = 0;
      if (b.hops > 0) {
        b.hopFrom = b.x;
        b.hopTo = clamp(b.x + b.face * R(7, 14) * S.k, 8, S.W - 8);
        b.hopT = -R(0.05, 0.15);
      } else {
        b.act = 'look'; b.actT = R(0.3, 0.9);
      }
    }
  } else if (b.act === 'peck') {
    const k = (b.actDur - b.actT) / b.actDur;
    b.head = 1.0 * Math.max(0, Math.sin(k * Math.PI * Math.round(b.pecks)));
  } else {
    b.head += ((b.headTarget || 0) - b.head) * Math.min(1, dt * 12);
  }
  if (b.actT <= 0 && b.act !== 'hop') {
    const r = Math.random();
    if (r < 0.38) {
      b.act = 'peck'; b.pecks = Math.floor(R(2, 5)); b.actDur = b.actT = b.pecks * 0.22;
    } else if (r < 0.7) {
      b.act = 'hop'; b.hops = Math.floor(R(1, 4)); b.hopFrom = b.x;
      if (chance(0.35)) b.face *= -1;
      b.hopTo = clamp(b.x + b.face * R(7, 14) * S.k, 8, S.W - 8); b.hopT = 0;
    } else if (r < 0.85) {
      b.act = 'look'; b.headTarget = R(-0.5, 0.15); b.actT = R(0.4, 1.1);
    } else {
      b.act = 'look'; b.headTarget = -0.2; b.actT = R(0.4, 0.8);
      V.sparrow(pan(b.x));
    }
  }
  const scared = walkerNear(b.x, 95 * S.k) || pointerNear(pointers, b.x, b.y - 8 * S.k, 90 * S.k);
  if (b.stay <= 0 || scared) {
    b.state = 'out'; b.t = 0; b.dur = R(0.9, 1.4);
    b.sx = b.x; b.sy = b.y - b.hopH;
    const side = scared ? (chance(0.5) ? -1 : 1) : (b.x < S.W / 2 ? -1 : 1);
    b.tx = side < 0 ? -30 : S.W + 30;
    b.ty = S.groundY - R(120, 260) * S.k;
    V.flutter(pan(b.x));
  }
  return true;
}

export function updateBirds(dt, wind, pointers) {
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i];
    f.t += dt;
    if (f.kind === 'swallow') {
      f.x += f.dir * f.v * dt;
      const prog = f.dir > 0 ? f.x / S.W : 1 - f.x / S.W;
      const dive = f.dive > 0 ? Math.exp(-(((prog - f.dive) / 0.12) ** 2)) * 90 * S.k : 0;
      f.prevY = f.y;
      f.y = f.y0 + Math.sin(f.t * f.w * TAU * 0.5 + f.ph) * f.amp + dive;
      f.ft -= dt;
      if (f.ft <= 0) {
        f.flapping = !f.flapping;
        f.ft = f.flapping ? R(0.25, 0.5) : R(0.3, 0.8);
      }
      f.fp += dt * (f.flapping ? 26 : 0);
      if (!f.called && prog > 0.35 && f.near) {
        f.called = true;
        if (chance(0.7)) V.swallow(pan(f.x));
      }
      if (prog > 1.15) flyers.splice(i, 1);
    } else {
      f.x += f.dir * f.v * dt;
      for (const m of f.members) m.fp += dt * m.fr * TAU;
      if (f.kind === 'crows') {
        f.nextCall -= dt;
        if (f.nextCall <= 0 && f.calls < 4 && f.x > 0 && f.x < S.W) {
          f.calls++;
          f.nextCall = R(1.4, 3.5);
          V.crow(pan(f.x), Math.floor(R(1, 3.99)));
        }
      }
      const tail = Math.max(...f.members.map((m) => Math.abs(m.dx)));
      if ((f.dir > 0 && f.x - tail > S.W + 60) || (f.dir < 0 && f.x + tail < -60)) flyers.splice(i, 1);
    }
  }
  for (let i = mejiro.length - 1; i >= 0; i--) if (!updateMejiro(mejiro[i], dt, wind, pointers)) mejiro.splice(i, 1);
  for (let i = sparrows.length - 1; i >= 0; i--) if (!updateSparrow(sparrows[i], dt, pointers)) sparrows.splice(i, 1);
}

// ───────────── 画 ─────────────
function ell(ctx, x, y, rx, ry, rot) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}
function circ(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function place(ctx, x, y, s, face) {
  const d = S.dpr;
  ctx.setTransform(d * s * face, 0, 0, d * s, x * d, y * d);
}

function wing(ctx, x, y, f, col, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, f);
  ctx.fillStyle = col;
  ctx.beginPath();
  if (kind === 'swallow') {
    ctx.moveTo(0.08, 0);
    ctx.quadraticCurveTo(0.02, -0.3, -0.27, -0.68);
    ctx.quadraticCurveTo(-0.12, -0.3, -0.1, 0.02);
  } else if (kind === 'crow') {
    ctx.moveTo(0.12, 0);
    ctx.quadraticCurveTo(0.08, -0.35, -0.04, -0.6);
    ctx.lineTo(-0.1, -0.66); ctx.lineTo(-0.15, -0.6); ctx.lineTo(-0.21, -0.63); ctx.lineTo(-0.25, -0.56); ctx.lineTo(-0.3, -0.56);
    ctx.quadraticCurveTo(-0.24, -0.2, -0.17, 0.03);
  } else {
    ctx.moveTo(0.1, 0);
    ctx.quadraticCurveTo(0.03, -0.3, -0.13, -0.5);
    ctx.lineTo(-0.3, -0.45);
    ctx.quadraticCurveTo(-0.24, -0.2, -0.18, 0.02);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMejiroPerched(ctx, m) {
  place(ctx, m.x, m.y, m.s, m.face);
  const by = -0.42 + m.crouch * 0.06;
  ctx.fillStyle = '#6a7826';
  ctx.beginPath();
  ctx.moveTo(-0.26, by + 0.06);
  ctx.lineTo(-0.78, -0.16 - m.tail * 0.14);
  ctx.lineTo(-0.75, -0.07 - m.tail * 0.12);
  ctx.lineTo(-0.2, by + 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5f6064';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.22); ctx.lineTo(-0.04, 0);
  ctx.moveTo(0.07, -0.22); ctx.lineTo(0.08, 0);
  ctx.stroke();
  ctx.fillStyle = '#8f9f33';
  ell(ctx, -0.02, by, 0.35, 0.245, -0.42);
  ctx.fillStyle = '#ece8d8';
  ell(ctx, 0.07, by + 0.1, 0.23, 0.15, -0.55);
  ctx.fillStyle = 'rgba(205,188,150,0.7)';
  ell(ctx, -0.04, by + 0.12, 0.17, 0.085, -0.3);
  ctx.fillStyle = '#6f7e28';
  ell(ctx, -0.11, by - 0.01, 0.27, 0.125, -0.36);
  ctx.strokeStyle = 'rgba(52,60,18,0.5)';
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(-0.16, by + 0.03); ctx.lineTo(-0.34, by + 0.09);
  ctx.moveTo(-0.12, by + 0.07); ctx.lineTo(-0.3, by + 0.13);
  ctx.stroke();
  ctx.save();
  ctx.translate(0.17, by - 0.17);
  ctx.rotate(m.head);
  ctx.fillStyle = '#9cac36';
  circ(ctx, 0.09, -0.13, 0.19);
  ctx.fillStyle = '#e1d34a';
  ell(ctx, 0.14, 0.0, 0.13, 0.085, 0.2);
  ctx.fillStyle = '#fbfbf4';
  circ(ctx, 0.15, -0.16, 0.072);
  ctx.fillStyle = '#141414';
  circ(ctx, 0.156, -0.162, 0.04);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  circ(ctx, 0.168, -0.176, 0.012);
  ctx.fillStyle = '#46464a';
  ctx.beginPath();
  ctx.moveTo(0.26, -0.15); ctx.lineTo(0.41, -0.11); ctx.lineTo(0.26, -0.08);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMejiroFly(ctx, m) {
  place(ctx, m.x, m.y, m.s, m.face);
  wing(ctx, -0.02, -0.04, m.flap * 0.9, '#5f6c22');
  ctx.fillStyle = '#6a7826';
  ctx.beginPath();
  ctx.moveTo(-0.25, -0.02); ctx.lineTo(-0.62, -0.06); ctx.lineTo(-0.6, 0.04); ctx.lineTo(-0.24, 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f9f33';
  ell(ctx, 0, 0, 0.34, 0.15, -0.06);
  ctx.fillStyle = '#ece8d8';
  ell(ctx, 0.04, 0.06, 0.25, 0.085, -0.05);
  ctx.fillStyle = '#9cac36';
  circ(ctx, 0.3, -0.06, 0.155);
  ctx.fillStyle = '#e1d34a';
  ell(ctx, 0.33, 0.04, 0.1, 0.06, 0);
  ctx.fillStyle = '#fbfbf4';
  circ(ctx, 0.35, -0.08, 0.06);
  ctx.fillStyle = '#141414';
  circ(ctx, 0.355, -0.08, 0.033);
  ctx.fillStyle = '#46464a';
  ctx.beginPath();
  ctx.moveTo(0.44, -0.07); ctx.lineTo(0.56, -0.04); ctx.lineTo(0.44, -0.02);
  ctx.closePath();
  ctx.fill();
  wing(ctx, 0.02, -0.06, m.flap, '#7a8a2c');
}

function drawSwallow(ctx, f) {
  const fl = f.flapping ? Math.sin(f.fp) : 0.28;
  const tilt = clamp((f.y - f.prevY) * 0.02, -0.35, 0.35);
  place(ctx, f.x, f.y, f.s, f.dir);
  ctx.rotate(tilt * f.dir);
  wing(ctx, 0, -0.02, fl * 0.95, '#141a28', 'swallow');
  ctx.fillStyle = '#1a2130';
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.015); ctx.lineTo(-0.68, -0.09); ctx.lineTo(-0.38, 0); ctx.lineTo(-0.68, 0.08); ctx.lineTo(-0.16, 0.025);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1f2840';
  ell(ctx, 0, 0, 0.27, 0.075, 0);
  ctx.fillStyle = '#ece6d8';
  ell(ctx, 0.02, 0.03, 0.18, 0.038, 0);
  ctx.fillStyle = '#1f2840';
  circ(ctx, 0.23, -0.005, 0.072);
  ctx.fillStyle = '#9b3a2a';
  ell(ctx, 0.27, 0.035, 0.05, 0.03, 0);
  wing(ctx, 0.03, -0.03, fl, '#1c2335', 'swallow');
}

function drawFlock(ctx, f, pal) {
  const d = S.dpr;
  const crow = f.kind === 'crows';
  for (const m of f.members) {
    const x = f.x + m.dx + parX(0.15);
    const y = f.y0 + m.dy + Math.sin(f.t * 0.8 + m.wob) * 3 * S.k + parY(0.15);
    if (x < -40 || x > S.W + 40) continue;
    const fl = Math.sin(m.fp);
    if (crow) {
      place(ctx, x, y, m.s, f.dir);
      wing(ctx, -0.01, -0.03, fl * 0.85, '#0f0f13', 'crow');
      ctx.fillStyle = '#16161b';
      ctx.beginPath();
      ctx.moveTo(-0.22, -0.03); ctx.lineTo(-0.56, -0.08); ctx.lineTo(-0.58, 0.05); ctx.lineTo(-0.22, 0.05);
      ctx.closePath();
      ctx.fill();
      ell(ctx, 0, 0, 0.32, 0.12, 0);
      circ(ctx, 0.3, -0.04, 0.11);
      ctx.beginPath();
      ctx.moveTo(0.38, -0.07); ctx.lineTo(0.53, -0.03); ctx.lineTo(0.38, 0);
      ctx.closePath();
      ctx.fill();
      wing(ctx, 0.02, -0.04, fl, '#16161b', 'crow');
    } else {
      ctx.setTransform(d * m.s * f.dir, 0, 0, d * m.s, x * d, y * d);
      ctx.strokeStyle = pal.dark > 0.5 ? 'rgba(200,205,225,0.5)' : 'rgba(58,52,48,0.62)';
      ctx.lineWidth = 0.32;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-1, -fl * 0.55);
      ctx.quadraticCurveTo(-0.45, -fl * 0.25 - 0.1, 0, 0.1);
      ctx.quadraticCurveTo(0.45, -fl * 0.25 - 0.1, 1, -fl * 0.55);
      ctx.stroke();
    }
  }
}

function drawSparrow(ctx, b) {
  const d = S.dpr;
  if (b.state === 'ground') {
    // 脚下一点影子
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = 'rgba(40,32,26,0.12)';
    ell(ctx, b.x, b.y + 1, b.s * 0.32 * (1 - b.hopH / (12 * S.k)), b.s * 0.07, 0);
    place(ctx, b.x, b.y - b.hopH, b.s, b.face);
    ctx.fillStyle = '#4d3a2b';
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.3); ctx.lineTo(-0.6, -0.44); ctx.lineTo(-0.58, -0.35); ctx.lineTo(-0.18, -0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9a7e70';
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(0, -0.18); ctx.lineTo(-0.03, 0);
    ctx.moveTo(0.07, -0.18); ctx.lineTo(0.08, 0);
    ctx.stroke();
    ctx.fillStyle = '#8b6c4c';
    ell(ctx, -0.02, -0.3, 0.31, 0.2, -0.12);
    ctx.fillStyle = '#d8d0c2';
    ell(ctx, 0.06, -0.24, 0.21, 0.12, -0.1);
    ctx.fillStyle = '#5b4532';
    ell(ctx, -0.08, -0.33, 0.24, 0.115, -0.18);
    ctx.strokeStyle = 'rgba(214,196,164,0.8)';
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(-0.02, -0.36); ctx.lineTo(-0.2, -0.33);
    ctx.stroke();
    ctx.save();
    ctx.translate(0.15, -0.42);
    ctx.rotate(b.head);
    ctx.fillStyle = '#7b4a2c';
    circ(ctx, 0.08, -0.08, 0.165);
    ctx.fillStyle = '#f0ebe0';
    ell(ctx, 0.11, -0.02, 0.11, 0.075, 0);
    ctx.fillStyle = '#222';
    circ(ctx, 0.12, -0.01, 0.035);
    ctx.fillStyle = '#111';
    circ(ctx, 0.15, -0.1, 0.028);
    ctx.fillStyle = '#2a2a2a';
    ell(ctx, 0.19, 0.05, 0.05, 0.035, 0);
    ctx.fillStyle = '#3a3530';
    ctx.beginPath();
    ctx.moveTo(0.22, -0.1); ctx.lineTo(0.32, -0.07); ctx.lineTo(0.22, -0.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    place(ctx, b.x, b.y, b.s, b.face);
    const fl = Math.sin(b.fp);
    wing(ctx, -0.02, -0.03, fl * 0.9, '#4d3a2b');
    ctx.fillStyle = '#4d3a2b';
    ctx.beginPath();
    ctx.moveTo(-0.24, -0.02); ctx.lineTo(-0.55, -0.05); ctx.lineTo(-0.54, 0.04); ctx.lineTo(-0.22, 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8b6c4c';
    ell(ctx, 0, 0, 0.33, 0.15, -0.05);
    ctx.fillStyle = '#d8d0c2';
    ell(ctx, 0.04, 0.06, 0.24, 0.08, 0);
    ctx.fillStyle = '#7b4a2c';
    circ(ctx, 0.3, -0.05, 0.14);
    ctx.fillStyle = '#f0ebe0';
    ell(ctx, 0.33, 0.0, 0.09, 0.06, 0);
    wing(ctx, 0.02, -0.05, fl, '#6a5038');
  }
}

// 树后：远处鸟群、归鸦、远处的燕子
export function drawFarBirds(ctx, pal) {
  for (const f of flyers) {
    if (f.kind === 'swallow') {
      if (!f.near) drawSwallow(ctx, f);
    } else drawFlock(ctx, f, pal);
  }
}
// 中排与前排花串之间：枝头的绣眼
export function drawPerchedBirds(ctx) {
  for (const m of mejiro) {
    if (m.t < 0) continue;
    if (m.state === 'perch') drawMejiroPerched(ctx, m);
  }
}
// 最前：飞行中的绣眼、近处的燕子
export function drawNearBirds(ctx) {
  for (const m of mejiro) {
    if (m.t < 0) continue;
    if (m.state !== 'perch') drawMejiroFly(ctx, m);
  }
  for (const f of flyers) if (f.kind === 'swallow' && f.near) drawSwallow(ctx, f);
}
export function drawGroundBirds(ctx) {
  for (const b of sparrows) if (b.t >= 0) drawSparrow(ctx, b);
}
