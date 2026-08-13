# 家庭大屏

1080 × 1920 竖屏家庭公告板。视觉严格以项目 Penpot 的三个 Light 画板为准。

## 公司电脑本地开发

本地开发不需要、也不使用 Docker，只需要 Node.js 22 LTS 和 npm。

```powershell
npm install
npm run dev
```

- 网页：http://localhost:5173
- 本地 API：http://localhost:3000/api/v1/health
- 默认使用 `packages/test-data` 中的模拟数据。
- Vite 会把 `/api` 和 `/media` 请求代理到本地 Fastify。

常用命令：

```powershell
npm run typecheck
npm test
npm run build
```

## 字体

界面统一使用 OPPO Sans 4.0，字体原文件与授权说明保存在 `apps/web/public/fonts/`。项目不修改字体文件；离线部署时由网页服务直接提供字体，无需在树莓派或 NAS 系统中另行安装。

## 本地生产模式预览

这同样不需要 Docker：

```powershell
npm run build
npm start
```

打开 http://localhost:3000。`/status` 和 `/photos` 可以直接打开或刷新。

## 群晖部署

`Dockerfile` 和 `docker-compose.yml` 只用于 NAS 部署，不参与公司电脑的日常开发。

部署前需按实际情况修改 `docker-compose.yml` 中的照片、缓存和配置目录，并在 NAS 环境中提供 `HA_BASE_URL` 与 `HA_TOKEN`。DSM6 的 Docker、Compose 版本和 CPU 架构需要在实际部署时确认。
