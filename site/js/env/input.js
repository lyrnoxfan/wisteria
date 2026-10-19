// 输入：手指/鼠标（可多点）、视差（陀螺仪或鼠标位置）、首次手势回调
import { clamp, damp } from '../lib/util.js';
import { S } from '../view/stage.js';

export const pointers = new Map(); // id -> { x, y, vx, vy, down, mouse, t }
const firstGesture = [];
let gestured = false;
const tilt = { x: 0, y: 0, has: false };
const mouse = { x: 0, y: 0, has: false };

export function onFirstGesture(fn) {
  if (gestured) fn();
  else firstGesture.push(fn);
}

function gesture() {
  if (gestured) return;
  gestured = true;
  for (const fn of firstGesture.splice(0)) {
    try {
      fn();
    } catch (e) {
      /* 忽略 */
    }
  }
}

function track(e, down) {
  let p = pointers.get(e.pointerId);
  const now = e.timeStamp || performance.now();
  if (!p) {
    p = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, down: false, mouse: e.pointerType === 'mouse', t: now };
    pointers.set(e.pointerId, p);
  }
  const dt = Math.max(4, now - p.t) / 1000;
  const vx = (e.clientX - p.x) / dt;
  const vy = (e.clientY - p.y) / dt;
  p.vx = p.vx * 0.5 + clamp(vx, -4000, 4000) * 0.5;
  p.vy = p.vy * 0.5 + clamp(vy, -4000, 4000) * 0.5;
  p.x = e.clientX;
  p.y = e.clientY;
  p.t = now;
  if (down !== undefined) p.down = down;
  if (p.mouse) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.has = true;
  }
  return p;
}

export function initInput(target) {
  const opts = { passive: true };
  target.addEventListener('pointerdown', (e) => {
    const p = track(e, true);
    p.vx = 0;
    p.vy = 0;
  }, opts);
  window.addEventListener('pointermove', (e) => track(e), opts);
  const end = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.mouse && e.type === 'pointerup') p.down = false;
    else pointers.delete(e.pointerId);
  };
  window.addEventListener('pointerup', end, opts);
  window.addEventListener('pointercancel', end, opts);
  document.addEventListener('pointerleave', (e) => pointers.delete(e.pointerId), opts);
  window.addEventListener('blur', () => pointers.clear());

  // 手势解锁（声音、iOS 陀螺仪授权）
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, gesture, opts);

  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    tilt.has = true;
    tilt.x = clamp(e.gamma / 28, -1, 1);
    tilt.y = clamp((e.beta - 50) / 30, -1, 1);
  }, opts);
  onFirstGesture(() => {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => {});
  });
}

// 每帧：视差缓动、指针速度衰减
export function updateInput(dt) {
  let tx = 0, ty = 0;
  if (tilt.has) {
    tx = -tilt.x;
    ty = -tilt.y;
  } else if (mouse.has) {
    tx = -(mouse.x / S.W - 0.5) * 2;
    ty = -(mouse.y / S.H - 0.5) * 2;
  }
  S.par.x = damp(S.par.x, clamp(tx, -1, 1), 2.2, dt);
  S.par.y = damp(S.par.y, clamp(ty, -1, 1), 2.2, dt);
  const now = performance.now();
  for (const p of pointers.values()) {
    if (now - p.t > 60) {
      p.vx *= Math.exp(-12 * dt);
      p.vy *= Math.exp(-12 * dt);
    }
  }
}
