// server.mjs —— 自托管:静态站 + /api/llm 代理(密钥留服务器,不进浏览器)
// 运行(三选一,优先级 高→低):
//   1) .env 文件里有 DEEPSEEK_KEY=...   →  node server.mjs   (推荐,key 不进 ps/历史)
//   2) 命令行: DEEPSEEK_KEY=sk-... node server.mjs   (自测用,会进 ps)
//   3) systemd EnvironmentFile / pm2 env   (生产)
// 部署:把 dist/ 和 server.mjs 放服务器,用 pm2/systemd 常驻,nginx 反代到域名

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// 读本地 .env(若存在),不覆盖已设的环境变量;零依赖手写
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  }
}
loadDotEnv(path.resolve(".env"));

const PORT = process.env.PORT || 4173;
const DIST = path.resolve("dist");
const KEY = process.env.DEEPSEEK_KEY;
// 代理白名单:只转发这些 baseURL,防止被当开放代理滥用
const ALLOW = [
  "https://api.deepseek.com",
  "https://api.deepseek.com/v1",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  let p = path.join(DIST, url);
  if (!p.startsWith(DIST)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    // SPA fallback
    p = path.join(DIST, "index.html");
  }
  const ext = path.extname(p);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}

const server = http.createServer(async (req, res) => {
  // CORS(同源其实不需要;留作本地 vite dev 跨端口调试用)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/llm") {
    if (!KEY) return sendJson(res, 500, { error: "server: 未配置 DEEPSEEK_KEY" });
    try {
      const { baseURL, ...payload } = JSON.parse(await readBody(req));
      if (!ALLOW.includes(baseURL))
        return sendJson(res, 403, {
          error: "server: 该 provider 不在代理白名单。请在配置面板粘贴你自己的 key 直连该 provider。",
        });
      const r = await fetch(baseURL.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(text);
    } catch (e) {
      sendJson(res, 502, { error: "server: " + (e?.message || String(e)) });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`genads-demo serving dist + /api/llm  →  http://localhost:${PORT}`);
  console.log(`  DEEPSEEK_KEY: ${KEY ? "已配置(服务器侧,不进浏览器)" : "未配置(无 key 时前端会回退预设)"}`);
});
