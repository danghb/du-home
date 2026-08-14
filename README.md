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

## Home Assistant

Home Assistant 由 NAS 端服务访问，访问令牌不会发送给树莓派浏览器。当前已接入天气、房间温湿度、空调状态、门锁状态、开启设备统计、待办事项和购物清单。

1. 在 Home Assistant 个人资料页创建长期访问令牌。
2. 将 `.env.example` 复制为不会被 Git 跟踪的 `.env`。
3. 填写 `HA_TOKEN`，并将 `APP_DATA_MODE` 改为 `live`。
4. 如果 HA 中只有一个 `weather.*` 实体，`HA_WEATHER_ENTITY` 可以留空；否则填写需要展示的实体 ID。

服务启动时预热天气快照，之后默认每 5 分钟在后台刷新。网页请求只读取内存缓存；HA 暂时不可用时继续保留最后一次成功数据。可通过 `HA_WEATHER_REFRESH_MINUTES` 调整刷新周期。

家居状态与清单默认每 30 秒后台刷新，可通过 `HA_DATA_REFRESH_SECONDS` 调整。使用 `npm run inspect:ha` 可以重新生成去除 Token 与位置坐标的实体/区域/仪表盘清单，输出保存在 `output/ha-inventory/inventory.json`。

公司电脑仍直接运行：

```powershell
npm run dev
```

服务启动时会自动读取项目根目录的 `.env`，无需 Docker。Token 不应提交到仓库或写入前端代码。

## 群晖部署

`Dockerfile` 和 `docker-compose.yml` 只用于 NAS 部署，不参与公司电脑的日常开发。

### 1. 部署前确认

在群晖 SSH 终端执行：

```sh
uname -m
sudo docker version
docker-compose version
```

当前 NAS 是 `linux/amd64`。项目推送到 GitHub 的 `master` 分支后，GitHub Actions 会构建 amd64 镜像并发布为 `ghcr.io/danghb/du-home:latest`。NAS 优先拉取该成品镜像，不需要访问 Docker Hub，也不在公司电脑运行 Docker。

### 2. 配置

把项目复制到 NAS，例如 `/volume1/docker/family-display/app`。在项目目录复制 `.env.example` 为 `.env`，至少填写：

```dotenv
HA_BASE_URL=https://你的-home-assistant-地址/
HA_TOKEN=你的长期访问令牌
HA_WEATHER_ENTITY=weather.forecast_wo_de_jia
DISPLAY_PORT=3000
PHOTO_HOST_PATH=/volume1/photos
HOME_PHOTO_ROTATION_SECONDS=20
PAGE_ROTATION_ENABLED=true
PAGE_ROTATION_SCHEDULE=home:30,weather:30,status:30,photos:45
```

`PHOTO_HOST_PATH` 必须是 NAS 上真实存在的照片目录，容器只读挂载它。WebP 缩略图保存在 Docker 自动管理的 `photo-cache` 命名卷中，无需配置缓存目录；重建容器时缓存仍会保留。`.env` 已被 Git 和 Docker 构建上下文排除，不要提交或复制到公开位置。

### 3. 拉取和启动

```sh
cd /volume1/docker/family-display/app
sudo docker-compose config
sudo docker-compose pull
sudo docker-compose up -d --no-build
sudo docker-compose ps
sudo docker-compose logs --tail=100 family-display
```

如果 GHCR 镜像设为私有，需要先创建具有 `read:packages` 权限的 GitHub Token，然后执行 `sudo docker login ghcr.io -u danghb`，在密码提示中输入 Token。公开镜像可以匿名拉取。

浏览器打开 `http://NAS局域网地址:3000`。容器提供 `/api/v1/health` 健康检查，日志自动限制为 3 个、每个最多 10 MB。照片服务启动后在后台建立索引；缩略图与照片元数据索引都保存在 Docker 命名卷中，容器重启时会先恢复已有照片再静默扫描。首次扫描会渐进显示并定期保存进度，后续每 60 分钟扫描一次并复用未变化照片的缓存。

显示方向由 URL 控制，不需要切换树莓派的系统显示方向：默认地址为竖屏；`?orientation=landscape` 将整张画布顺时针旋转为横屏；`?orientation=landscape-reverse` 反向旋转。页面切换时方向参数会保留。

首页照片默认每 20 秒随机轮换且不会连续重复。页面自动轮换默认开启，`PAGE_ROTATION_SCHEDULE` 使用“页面 ID:停留秒数”的格式；当前页面 ID 为 `home`、`weather`、`status`、`photos`。设置 `PAGE_ROTATION_ENABLED=false` 可关闭自动轮换。修改 `.env` 后执行 `sudo docker-compose up -d --no-build` 重建容器使配置生效。

仅当 NAS 能正常访问 Docker Hub 时，才使用 `sudo docker-compose build` 在 NAS 本地构建；日常部署不采用该方式。
