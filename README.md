# OM Fund Web

基金与指数自选行情 PWA。前端使用 Vue 3 + TypeScript + Vite，行情接口通过 Vercel Functions 同源访问。

## 本地开发

安装依赖：

```bash
npm install
```

仅开发静态页面：

```bash
npm run dev
```

本地预览：

```bash
npm run dev
```

## 验证

```bash
npm test
npm run build
```

## Vercel 部署

项目已经同时适配 Vercel。部署时将 Vercel 项目根目录设置为 `om-fund-web`，使用以下配置：

- 构建命令：`npm run build`
- 输出目录：`dist`
- 安装命令：按项目中的 `package-lock.json` 自动执行 `npm install`

根目录的 `api/[...path].js` 会将 `/api/search`、`/api/quotes` 和 `/api/fund-detail` 映射到 Vercel Function，并复用现有接口实现。`vercel.json` 中的 rewrite 用于支持基金详情页的前端路由刷新。

通过 GitHub 部署时，在 Vercel 导入仓库后直接点击 Deploy 即可。也可以在项目目录使用 Vercel CLI：

```bash
npx vercel
npx vercel --prod
```

部署完成后建议验证首页、任意基金详情页，以及 `/api/search?q=000751` 接口。

## Netlify 部署

项目同时提供了 Netlify Functions 入口。将仓库导入 Netlify 后，构建设置使用：

- Build command：`npm run build`
- Publish directory：`dist`
- Functions directory：`netlify/functions`

根目录的 `netlify.toml` 已配置 `/api/*` 到 Netlify Function 的重写，以及前端路由回退。部署完成后可验证：

```text
https://你的站点.netlify.app/api/search?q=000751
https://你的站点.netlify.app/api/quotes?codes=000001%2C399001%2C399006
```

## 数据说明

行情数据来自公开市场信息，可能存在延迟，仅供参考，不构成投资建议。第三方接口并非正式开放契约，上线后需持续关注字段变化和限流情况。
