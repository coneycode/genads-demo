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

## 设计文档

- 思路与话术：`~/Documents/生成式广告Demo方案.md`
- 实现规格：`~/Documents/生成式广告Demo_实现规格书.md`
