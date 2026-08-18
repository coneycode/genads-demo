# 生成式广告 · Chat 原生变现沙盘

面试用交互 demo：在 AI 对话里插入商业信息时，**信任 vs 收入**的实时权衡沙盘。
面试官可发消息、拖动「变现激进度」滑块、调整广告主出价，亲眼看到护栏红线如何一票否决。

## 运行

```bash
cd ~/Documents/genads-demo
npm install        # 已装过可跳过
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 产物在 dist/
npm run preview    # 预览构建产物 http://localhost:4173
```

## 三幕引导

打开页面会自动弹引导浮层（可跳过/重开，点顶部「引导演示」按钮）：

1. **AI 是有分寸的** —— 强商业问题出商品卡，纯情感问题克制不触发。
2. **贪婪是有代价的** —— 拖动顶部「变现激进度」滑块到激进，护栏指标接连破线变红、一票否决。
3. **背后有套可解释的机器** —— 在装修场景把「低价装修(硬广)」出价拉到最高，仍因体验分太低排不上。

## 真实 LLM 模式（可选）

顶部切「真实 LLM」→「配置」：填 Base URL / Model / API Key（仅存内存、不持久化）。
断网或填错会自动回退到预设引擎，演示不中断。
默认填的是 OpenAI 兼容地址，可改成 DeepSeek/火山方舟等任何 OpenAI 兼容服务。

## 部署

```bash
# Vercel
npm run build && npx vercel deploy --prod dist

# GitHub Pages（仓库名替换 <repo>）
npm run build
# 若部署到 https://<user>.github.io/<repo>/，需在 vite.config.ts 中加  base: "/<repo>/"
# 然后把 dist 推到 gh-pages 分支
```

## 自托管(自有服务器,推荐:密钥不进浏览器)

`server.mjs` 用 Node 内置模块,零依赖,同时托管静态 `dist/` + `/api/llm` 代理。
密钥 `DEEPSEEK_KEY` 只存在服务器环境变量里,前端无 key 时走代理,DeepSeek 由服务器调用——**密钥永不进入浏览器 bundle**。

```bash
npm run build
# 服务器上(把 dist/ 和 server.mjs 放一起):
DEEPSEEK_KEY=sk-你的key PORT=4173 node server.mjs
# 常驻推荐 pm2:  pm2 start server.mjs --name genads --env DEEPSEEK_KEY=sk-...
# nginx 反代到你的域名(可后加 HTTPS)
```

- 默认 Provider/Model 仍预填 DeepSeek / `deepseek-v4-flash`。
- 无 key → 走 `/api/llm`(服务器注入 key,白名单仅 DeepSeek)。
- 想换 provider(OpenAI/火山方舟等)→ 在配置面板粘贴该 provider 的 key,前端直连(不走代理)。

## 设计文档

- 思路与话术：`~/Documents/生成式广告Demo方案.md`
- 实现规格：`~/Documents/生成式广告Demo_实现规格书.md`
