import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const writes = [];
globalThis.caches = { default: { match: async () => null, put: async (key, value) => writes.push([key, value]) } };
globalThis.fetch = async () => new Response('<!doctype html><title>preview</title>', { status: 200 });
const source = await readFile(new URL('../deploy/home-worker.js', import.meta.url), 'utf8');
const worker = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const ctx = { waitUntil: (promise) => promise };

test('malformed percent encoding returns a hardened 400 instead of throwing', async () => {
  const response = await worker.default.fetch(new Request('https://preview.example/%E0%A4%A'), {}, ctx);
  assert.equal(response.status, 400);
  assert.equal(await response.text(), 'Bad Request');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('normal asset requests still resolve and receive a version header', async () => {
  const response = await worker.default.fetch(new Request('https://preview.example/'), {}, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(response.headers.get('x-site-version'), /^[a-f0-9]{7}$/);
  assert.match(await response.text(), /preview/);
});

test('unsupported methods remain rejected', async () => {
  const response = await worker.default.fetch(new Request('https://preview.example/', { method: 'POST' }), {}, ctx);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});

test('site shell keeps zoom available and exposes keyboard/motion/sound controls', async () => {
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  assert.match(html, /height:\s*100dvh/);
  assert.match(html, /id="motion-toggle"/);
  assert.match(html, /id="sound-toggle"/);
  assert.match(html, /tabindex="0"/);
});

const previewSource = await readFile(new URL('../deploy/preview-worker.js', import.meta.url), 'utf8');
const previewWorker = await import(`data:text/javascript;base64,${Buffer.from(previewSource).toString('base64')}`);

test('isolated preview serves the pinned branch and hardens responses', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response('<!doctype html><title>preview</title>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  };
  const response = await previewWorker.default.fetch(new Request('https://preview.example/'), {}, ctx);
  assert.match(requestedUrl, /raw\.githubusercontent\.com\/lyrnoxfan\/wisteria\/3487312dc0766080d0880371a44b9fd85b12b59c\/site\/index\.html$/);
  assert.equal(response.headers.get('x-site-version'), '3487312');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(await response.text(), /preview/);
});

test('isolated preview rejects malformed paths before fetching upstream', async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error('unexpected fetch'); };
  const response = await previewWorker.default.fetch(new Request('https://preview.example/%E0%A4%A'), {}, ctx);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(fetched, false);
});
