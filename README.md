# 3D Point Cloud Personal Website

这是一个基于 **Next.js + React Three Fiber + Three.js** 的个人网站实验项目。网站包含六个主要页面：

- 首页 `/`
- 个人详情页 `/personal-info`
- 作业 1：欧版 21 点 `/homework1`
- 作业 2：简化桥牌 `/homework2`
- 联系方式 `/contact`
- 背景点云设置 `/settings`

## 功能特性

- 全站 3D PCD 点云背景。
- 每个页面拥有独立的点云配置，包括 PCD 文件、预置旋转、颜色模式、偏移和缩放半径。
- 页面切换时点云会先向外扩张，再收缩到新页面配置，减少直接切换的生硬感。
- 支持 PCD 下载进度、加载失败时的程序化点云兜底，以及设置面板实时调整。
- 全局文字对比度、阴影和玻璃面板透明度经过优化，更适合叠加在动态点云背景上阅读。

## 本地运行

```bash
npm install
npm run dev
```

默认开发地址通常为：<http://localhost:3000>

## 构建检查

```bash
npm run build
```

## 点云文件放置方式

PCD 文件需要放在 `public/models/` 目录中。例如：

```text
public/models/example.pcd
public/models/cube.pcd
```

在代码中引用时使用以 `/models/` 开头的公开路径，例如：

```ts
pcdUrl: "/models/example.pcd"
```

## 为页面配置独立点云背景

页面点云配置集中维护在：

```text
src/lib/pointCloudPages.ts
```

每个路由可以配置：

- `label`：调试/状态显示名称。
- `pcdUrl`：当前页面使用的 PCD 文件。
- `targetRadius`：归一化后的目标半径。
- `preRotation`：导入 PCD 后的预置旋转，单位为弧度，用于修正点云朝向。
- `positionOffset`：点云整体位置偏移。
- `colorMode`：页面默认颜色模式。
- `transitionSeed`：程序化兜底点云与颜色生成的种子。

示例：

```ts
"/contact": {
  label: "联系方式 / Contact cloud",
  pcdUrl: "/models/example.pcd",
  targetRadius: 4.7,
  preRotation: [-0.28, -0.75, 0.05],
  positionOffset: [0.1, 0.08, 0],
  colorMode: "white",
  transitionSeed: 4,
}
```

## 点云设置说明

访问 `/settings` 可以调整：

- 相机距离与相机 X/Y 位置。
- 模型 X/Y 旋转，用于手动修正导入 PCD 的方向。
- 自动旋转和旋转速度。
- 点大小、颜色模式、鼠标交互灵敏度。

设置会保存到浏览器 `localStorage`，下次访问会自动恢复。旧版本保存的异常旋转速度会被自动限制到安全范围内。

## 项目结构

```text
src/app/                         Next.js App Router 页面
src/components/PointCloudBackground.tsx  全站点云渲染、加载与页面切换动画
src/components/PointCloudControls.tsx    点云设置面板
src/lib/pcdLoader.ts             PCD 解析与归一化工具
src/lib/pointCloudPages.ts       每个页面的点云背景配置
src/lib/PointCloudSettingsContext.tsx    全局点云设置与持久化
public/models/                   PCD 模型文件
```
