# 生成式广告 · Chat 原生变现沙盘

一个练手 demo：探索"在 AI 对话里插入商业信息时，**信任 vs 收入**如何权衡"。
发消息、拖动「变现激进度」滑块、调整广告主出价，亲眼看到护栏红线如何一票否决——
把"chat 原生变现"这个抽象问题做成一个能拨动、可解释的小模型，顺便练 React/TS。

> 当前仅做演示用，未接入真实大模型：只响应预设场景，其余提问统一回复"当前仅做演示用，未接入真实大模型，暂无法回答您的问题。"

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
