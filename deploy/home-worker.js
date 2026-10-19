// 藤 · lyrnox.com 入口 Worker
//
// 站点文件全部放在公开仓库 lyrnoxfan/wisteria 的 site/ 目录。
// 这个 Worker 只做三件事：
//   1. 按固定提交（SITE_SHA）从 GitHub 拉对应文件，内容不可变，边缘永久缓存；
//   2. 按扩展名给出正确的 Content-Type 和缓存策略；
//   3. 统一加安全头。
// 发布新版本 = push 到 GitHub + 把 SITE_SHA 换成新提交重新上传本脚本（几 KB）。
// 回滚 = 把 SITE_SHA 改回旧提交。

const SITE_SHA = "78be0adae457967199156cf88e74b94ee2625f28";
const REPO = "lyrnoxfan/wisteria";
const ROOT = "site";

const UPSTREAMS = [
  (p) => `https://raw.githubusercontent.com/${REPO}/${SITE_SHA}/${ROOT}${p}`,
  (p) => `https://cdn.jsdelivr.net/gh/${REPO}@${SITE_SHA}/${ROOT}${p}`,
];

const TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  svg: "image/svg+xml",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
};

// 浏览器缓存：页面和脚本短（新版本几分钟内生效），图片长
const BROWSER_CACHE = {
  html: "public, max-age=60",
  js: "public, max-age=300",
  css: "public, max-age=300",
  webmanifest: "public, max-age=3600",
  default: "public, max-age=86400",
};

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; manifest-src 'self'; connect-src 'self'; " +
    "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const SAFE_PATH = /^\/[A-Za-z0-9._\-\/]*$/;

function extOf(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : "";
}

async function fetchUpstream(path) {
  for (const make of UPSTREAMS) {
    try {
      const r = await fetch(make(path), { cf: { cacheTtl: 31536000, cacheEverything: true } });
      if (r.status === 200) return r;
      if (r.status === 404) return null;
    } catch (e) {
      // 换下一个源
    }
  }
  throw new Error("upstream unavailable");
}

function respond(body, path, status) {
  const ext = extOf(path);
  const headers = new Headers({
    "content-type": TYPES[ext] || "application/octet-stream",
    "cache-control": BROWSER_CACHE[ext] || BROWSER_CACHE.default,
    "x-site-version": SITE_SHA.slice(0, 7),
  });
  for (const k in SECURITY) headers.set(k, SECURITY[k]);
  return new Response(body, { status, headers });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    if (!SAFE_PATH.test(path) || path.includes("..")) path = "/404.html";
    if (path.endsWith("/")) path += "index.html";
    if (!extOf(path)) path += "/index.html";

    const cache = caches.default;
    const key = new Request(`https://${url.host}/__site/${SITE_SHA}${path}`);
    let hit = await cache.match(key);
    if (hit) {
      const status = Number(hit.headers.get("x-site-status") || 200);
      return respond(req.method === "HEAD" ? null : hit.body, path === "/404.html" || status === 404 ? "/404.html" : path, status);
    }

    let status = 200;
    let up;
    try {
      up = await fetchUpstream(path);
      if (!up) {
        status = 404;
        path = "/404.html";
        up = await fetchUpstream(path);
      }
    } catch (e) {
      return new Response("藤 · 暂时无法连接源站", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (!up) return new Response("Not Found", { status: 404 });

    const buf = await up.arrayBuffer();
    ctx.waitUntil(
      cache.put(
        key,
        new Response(buf, {
          headers: { "cache-control": "public, max-age=31536000, immutable", "x-site-status": String(status) },
        })
      )
    );
    return respond(req.method === "HEAD" ? null : buf, path, status);
  },
};
