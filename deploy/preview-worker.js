// Isolated Wisteria preview: deploy this only to a workers.dev hostname.
// It serves the site tree from the pinned feature-branch commit, never a production route.
const SITE_SHA = "3487312dc0766080d0880371a44b9fd85b12b59c";
const BASE = `https://raw.githubusercontent.com/lyrnoxfan/wisteria/${SITE_SHA}/site`;
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; manifest-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const SAFE_PATH = /^\/[A-Za-z0-9._/-]*$/;

function withHeaders(response, path) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY)) headers.set(name, value);
  headers.set("x-site-version", SITE_SHA.slice(0, 7));
  headers.set("cache-control", /\.[a-z0-9]+$/i.test(path) ? "public, max-age=300" : "public, max-age=60");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request) {
    try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    let path;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return withHeaders(new Response("Bad Request", { status: 400 }), "/400.txt");
    }

    if (!SAFE_PATH.test(path) || path.includes("..")) path = "/404.html";
    if (path.endsWith("/")) path += "index.html";
    if (!/\.[A-Za-z0-9]+$/.test(path)) path += "/index.html";

    try {
      const upstream = await fetch(`${BASE}${path}`, { method: request.method });
      return withHeaders(upstream, path);
    } catch {
      return withHeaders(new Response("藤 · 暂时无法连接源站", { status: 502 }), "/502.txt");
    }
    } catch (error) {
      console.error("Preview Worker exception", error?.stack || error);
      return new Response(`Preview diagnostic: ${error?.name || "Error"}: ${error?.message || String(error)}`, { status: 500, headers: SECURITY });
    }
  },
};
