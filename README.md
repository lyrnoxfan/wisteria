# 藤

一棵挂在网上的日本紫藤。纯视觉，大面积留白。

## 场景

- **紫藤**：程序化生成的日本紫藤（固定种子，每次打开是同一棵树），
  85 串花穗钟摆微摆、羽状复叶、落花。
- **风**：时不时来一阵，花穗摆动加剧、落花增多并被吹偏。
- **鸟**：时不时一两只远鸟掠过，偶尔一小群（3~7 只），偶尔近处一对。
- **鸟鸣**：WebAudio 实时合成的远处鸟叫，淡入、响几声、淡出；
  首次点击/触摸页面后解锁（浏览器自动播放策略）。
- **行人**：时不时有一两个行人走过，在树下驻足仰望几秒再离开。

零文字、零外部资源，单文件 `site/index.html`（canvas + WebAudio）。
`prefers-reduced-motion` 下只渲染静态树。

## 部署

Cloudflare Workers 静态资源模式（`wrangler.toml`）。

- 长期：GitHub Actions push main 自动 `wrangler deploy`
  （需仓库 secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，
  token 必须在 Cloudflare 面板亲手创建——经 API 建会被 403）。
- 过渡：`.bridge-deploy.py`（gitignore，不进仓库）把 `site/` 内联成
  Worker 经 API 直接上传，先顶上线。
