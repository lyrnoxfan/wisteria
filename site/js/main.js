// 藤 v4 · 主入口
import { S, initStage, layout } from './view/stage.js';
import { params, Rng, clamp, toHex } from './lib/util.js';
import { Clock, paletteAt } from './env/clock.js';
import { Wind } from './env/wind.js';
import { pointers, initInput, updateInput, onFirstGesture } from './env/input.js';
import { TREE } from './data/tree.js';
import { layoutSky, renderSky, drawSky, drawMist } from './view/sky.js';
import { initTree, layoutTree, tintTree, updateTree, drawTree } from './view/tree.js';
import { initRacemes, layoutRacemes, tintRacemes, updateRacemes, drawRacemes, drawRacemeGlow } from './view/racemes.js';
import { initPetals, updatePetals, drawAirPetals, drawGroundPetals, burstAt, resetPetals } from './view/petals.js';
import { initGround, layoutGround, drawGround } from './view/ground.js';
import { updateBirds, drawFarBirds, drawPerchedBirds, drawNearBirds, drawGroundBirds, resetBirds, spawnMejiro, spawnSwallows, spawnFlock, spawnSparrows } from './view/birds.js';
import { initWalkers, layoutWalkers, tintWalkers, updateWalkers, drawWalkers, spawnWalker } from './view/walkers.js';
import { unlockAudio, setAudioMuted } from './audio/engine.js';
import { startAmbience, updateAmbience, rustleTouch } from './audio/ambience.js';
import * as V from './audio/voices.js';
import { Director } from './director.js';

// 一棵树只开一种颜色：每次进来随机是紫藤、白藤或红藤（?fuji= 可指定）
const CULTIVARS = {
  violet: {
    w: 0.6,
    sprites: [1, 2, 3].map((i) => `/img/raceme-violet-${i}.webp`),
    weights: [0.42, 0.3, 0.28],
    petals: [[150, 112, 205], [122, 84, 182], [186, 160, 228], [214, 198, 238], [104, 70, 160]],
    glow: [160, 118, 255],
  },
  white: {
    w: 0.2,
    sprites: [1, 2, 3].map((i) => `/img/raceme-white-${i}.webp`),
    weights: [0.5, 0.25, 0.25],
    petals: [[246, 243, 248], [234, 231, 240], [250, 248, 238], [226, 224, 236]],
    glow: [215, 214, 255],
  },
  pink: {
    w: 0.2,
    sprites: [1, 2, 3].map((i) => `/img/raceme-pink-${i}.webp`),
    weights: [0.5, 0.28, 0.22],
    petals: [[238, 172, 206], [218, 126, 174], [246, 208, 226], [204, 116, 164]],
    glow: [255, 150, 210],
  },
};

const seed = params.seed != null ? params.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
S.seed = seed;
const rng = new Rng(seed);
const names = Object.keys(CULTIVARS);
const fuji = CULTIVARS[params.fuji] ? params.fuji : names[rng.weighted(names.map((n) => CULTIVARS[n].w))];
const cultivar = CULTIVARS[fuji];
S.layoutJitter = { x: rng.range(-0.025, 0.025), s: rng.range(0.96, 1.03) };
S.revealDur = 2.8;

const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let motionMode = motionQuery && motionQuery.matches ? 'still' : 'full';
let motionOverride = false;
let soundMuted = !!params.mute;
const clock = new Clock();
const wind = new Wind();
const director = new Director();
let ready = false;
let palTimer = 0;
const themeMeta = document.querySelector('meta[name="theme-color"]');

const canvas = document.getElementById('fuji');
const motionButton = document.getElementById('motion-toggle');
const soundButton = document.getElementById('sound-toggle');
const notice = document.getElementById('scene-notice');
initStage(canvas);
S.pal = paletteAt(clock.hour());
S.hour = S.pal.hour;
layout();
layoutSky(seed);
initInput(canvas);

onFirstGesture(() => {
  unlockAudio();
  startAmbience();
});

function onPalette() {
  const pal = S.pal;
  const top = toHex(pal.sky0);
  document.documentElement.style.background = top;
  if (themeMeta) themeMeta.setAttribute('content', top);
  if (!ready) return;
  tintTree(pal);
  tintRacemes(pal);
  tintWalkers(pal);
}

function relayout() {
  layout();
  layoutSky(seed);
  if (ready) {
    layoutTree();
    layoutRacemes(seed);
    layoutGround(seed);
    layoutWalkers();
    resetBirds();
    resetPetals();
  }
  onPalette();
  if (motionMode === 'still') renderStill();
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('load ' + src));
    im.src = src;
  });
}

function onBrush(x, y, energy) {
  if (Math.random() < 0.55 + energy * 0.4) burstAt(x, y, energy);
  rustleTouch(0.25 + energy * 0.6);
  V.brush(clamp((x / S.W) * 2 - 1, -0.9, 0.9), energy);
}

async function boot() {
  const tree = await loadImg(TREE.src);
  const spriteResults = await Promise.allSettled(cultivar.sprites.map(loadImg));
  const loadedSprites = spriteResults.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!loadedSprites.length) throw new Error('flower sprites unavailable');
  const sprites = spriteResults.map((r, i) => r.status === 'fulfilled' ? r.value : loadedSprites[i % loadedSprites.length]);
  const [walkResult, lookResult] = await Promise.allSettled([loadImg('/img/walker-walk.webp'), loadImg('/img/walker-look.webp')]);
  const walkersReady = walkResult.status === 'fulfilled' && lookResult.status === 'fulfilled';
  const walk = walkersReady ? walkResult.value : null;
  const look = walkersReady ? lookResult.value : null;
  if (spriteResults.some((r) => r.status === 'rejected') || !walkersReady) {
    notice.textContent = '部分素材暂时未能加载，已跳过缺失的装饰。';
    notice.hidden = false;
  }
  initTree(tree);
  initRacemes(sprites, cultivar, onBrush);
  initPetals(cultivar.petals);
  initGround(cultivar);
  if (walkersReady) initWalkers(walk, look);
  layoutTree();
  layoutRacemes(seed);
  layoutGround(seed);
  layoutWalkers();
  ready = true;
  onPalette();
  S.revealT0 = S.t + 0.15;
  director.start(S.t);
  document.documentElement.dataset.fuji = fuji;
  if (motionMode === 'still') renderStill();
}

function step(dt) {
  const motionDt = motionMode === 'soft' ? dt * 0.55 : dt;
  S.dt = motionDt;
  S.t += motionDt;
  palTimer -= motionDt;
  if (palTimer <= 0) {
    palTimer = params.speed > 1 ? 0.1 : 0.5;
    S.pal = paletteAt(clock.hour());
    S.hour = S.pal.hour;
    onPalette();
  }
  updateInput(motionDt);
  wind.update(motionDt, S.t, S.W, S.pal);
  if (ready) {
    S.reveal = clamp((S.t - S.revealT0) / S.revealDur, 0, 1);
    updateTree(motionDt, wind);
    const sub = motionDt > 1 / 45 ? 2 : 1;
    for (let i = 0; i < sub; i++) updateRacemes(motionDt / sub, wind, pointers);
    updatePetals(motionDt, wind, S.reveal >= 1);
    updateBirds(motionDt, wind, pointers);
    updateWalkers(motionDt);
    director.update(S.t, S.pal);
  }
  updateAmbience(motionDt, S.t, wind, S.pal);
}

function render() {
  const ctx = S.ctx;
  const pal = S.pal;
  renderSky(pal);
  drawSky(ctx, pal, S.t, S.dt);
  if (!ready) return;
  drawFarBirds(ctx, pal);
  drawRacemes(ctx, 0, pal);
  drawTree(ctx);
  drawGround(ctx, pal, S.t, wind);
  drawGroundPetals(ctx, pal);
  drawGroundBirds(ctx);
  drawWalkers(ctx, pal);
  drawRacemes(ctx, 1, pal);
  drawPerchedBirds(ctx);
  drawRacemes(ctx, 2, pal);
  drawRacemeGlow(ctx, pal);
  drawAirPetals(ctx, pal);
  drawNearBirds(ctx);
  drawMist(ctx, pal);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// 减少动态：只画一帧静止的画
function renderStill() {
  if (!ready) {
    render();
    return;
  }
  S.revealT0 = -100;
  for (let i = 0; i < 150; i++) step(1 / 60);
  render();
}

// 自适应画质：主线程每帧耗时持续偏高就降分辨率
let last = performance.now();
let rafId = 0;
let work = 8, workT = 0;
function frame(now) {
  rafId = 0;
  if (document.hidden || motionMode === 'still') return;
  let dt = (now - last) / 1000;
  last = now;
  // A rAF timestamp can match performance.now() on the first frame; keep the loop alive.
  if (!(dt > 0)) dt = 1 / 60;
  if (dt > 0.1) dt = 0.1;
  const t0 = performance.now();
  step(dt);
  render();
  const spent = performance.now() - t0;
  work += (spent - work) * 0.05;
  if (ready && S.reveal >= 1) {
    workT = work > 15 ? workT + dt : 0;
    if (workT > 3 && S.quality > 0.6) {
      S.quality = Math.max(0.6, S.quality - 0.2);
      workT = 0;
      relayout();
    }
  }
  if (!document.hidden && motionMode !== 'still') rafId = requestAnimationFrame(frame);
}

function startLoop() {
  if (rafId || document.hidden || motionMode === 'still') return;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

function updateMotionButton() {
  motionButton.textContent = motionMode === 'full' ? '完整动态' : motionMode === 'soft' ? '轻柔动态' : '静帧';
  motionButton.setAttribute('aria-label', `当前${motionButton.textContent}，切换动画强度`);
}

function setMotionMode(mode, userChoice = false) {
  motionMode = mode;
  if (userChoice) motionOverride = true;
  updateMotionButton();
  if (motionMode === 'still') {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    renderStill();
  } else startLoop();
}

motionButton.addEventListener('click', () => {
  const next = motionMode === 'full' ? 'soft' : motionMode === 'soft' ? 'still' : 'full';
  setMotionMode(next, true);
});
soundButton.addEventListener('click', () => {
  soundMuted = !soundMuted;
  setAudioMuted(soundMuted);
  if (!soundMuted) { unlockAudio(); startAmbience(); }
  soundButton.textContent = soundMuted ? '声音：关' : '声音：开';
  soundButton.setAttribute('aria-label', soundMuted ? '开启环境音' : '静音环境音');
});
canvas.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    onBrush(S.W * 0.5, S.H * 0.58, 0.45);
  }
});
if (motionQuery) {
  const onMotionPreference = (e) => {
    if (!motionOverride) setMotionMode(e.matches ? 'still' : 'full');
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreference);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionPreference);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  } else startLoop();
});
updateMotionButton();
soundButton.textContent = soundMuted ? '声音：关' : '声音：开';
soundButton.setAttribute('aria-label', soundMuted ? '开启环境音' : '静音环境音');

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayout, 160);
});

boot().catch(() => {
  notice.textContent = '场景素材暂时未能加载，请刷新页面重试。';
  notice.hidden = false;
});
if (motionMode === 'still') renderStill();
else startLoop();

// 调试 / 截图用（控制台）：__fuji.spawn.mejiro() 等
window.__fuji = {
  S, wind, fuji, seed, V,
  spawn: { mejiro: spawnMejiro, swallow: spawnSwallows, flock: spawnFlock, sparrow: spawnSparrows, walker: spawnWalker },
  gust(s = 0.8, dir = 1) {
    wind.gusts.push({ t0: S.t, s, dir, c: S.W * 0.6, rise: 1, dur: 4, fall: 2, seed: Math.random() * 100 });
  },
};
