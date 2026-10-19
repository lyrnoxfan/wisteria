# 藤

一棵挂在网上的日本紫藤。没有菜单，没有说明文字：只有一棵树、风、昼夜、来访的鸟和偶尔在树下停住的人。

## 现在的场景

- 水墨伞形紫藤树冠与真实花穗素材；紫藤、白藤、粉藤三种花色可以通过 `?fuji=violet|white|pink` 指定。
- 花串以真实枝条锚点为基础的链式物理，阵风时一起摆动；点击或拖动会拨开花串并打落花瓣。
- 花瓣会在空气中翻转、受风，落到地面后短暂堆积，行人走过会踢起它们。
- 梅鸟会飞来停在枝头、转头、跳枝、啄花、鸣叫；燕子掠过，远处有鸟群，黄昏有归鸦，地面有会跳动的麻雀。
- Muse 行人精灵会从画面一侧走来，在树下减速、抬头停住，再继续离开；走路和抬头姿势交叉淡化。
- 本地时间驱动天空、月相、星星、霞带、薄雾、树影与夜间地灯。
- Web Audio 实时合成双声道风声、叶声、脚步、振翅、拨花沙沙、树莺、梅鸟、麻雀、燕子、乌鸦、猫头鹰和远寺钟；第一次触摸后解锁。
- `prefers-reduced-motion` 会变成静止插画；URL 可用 `?hour=12&seed=7` 做截图和调试。

## 本地预览

```bash
cd site
python3 -m http.server 8080
```

然后打开 <http://localhost:8080/>。可用 `?hour=21&fuji=white&seed=7` 查看夜晚白藤。

## 部署

`wrangler.toml` 保留 Cloudflare Workers Static Assets 配置；`.github/workflows/deploy.yml` 会在推送 `main` 后尝试部署，但需要仓库中的 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` secrets。

当前线上域名 `lyrnox.com` 由 `home` Worker 入口承载。`deploy/home-worker.js` 是不依赖 Worker Assets 的过渡入口：把 `SITE_SHA` 换成站点提交后，它会从 GitHub 固定提交拉取 `site/`，并在边缘缓存静态文件。

## 目录

- `site/index.html`：极简页面壳
- `site/js/`：天空、树、花串、花瓣、鸟、行人、时钟、风场、输入和音频模块
- `site/img/`：树、花穗、Muse 姿势、PWA 图标和分享图
- `deploy/home-worker.js`：线上 `home` Worker 的固定提交入口
