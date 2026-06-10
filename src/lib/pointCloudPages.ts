export type RoutePointCloudConfig = {
  label: string;
  pcdUrl: string;
  targetRadius: number;
  preRotation: [number, number, number];
  positionOffset: [number, number, number];
  colorMode: "default" | "blue" | "cyan" | "white" | "rainbow";
  transitionSeed: number;
};

export const PAGE_POINT_CLOUDS: Record<string, RoutePointCloudConfig> = {
  "/": {
    label: "首页 / Welcome cloud",
    pcdUrl: "/models/example.pcd",
    targetRadius: 4.8,
    preRotation: [-Math.PI/2, 0, 0],
    positionOffset: [0, 0, 0],
    colorMode: "default",
    transitionSeed: 0,
  },
  "/personal-info": {
    label: "个人详情 / Profile cube",
    pcdUrl: "/models/cube.pcd",
    targetRadius: 4.0,
    preRotation: [0.35, 0.2, -0.08],
    positionOffset: [0.15, 0, 0],
    colorMode: "rainbow",
    transitionSeed: 1,
  },
  "/homework1": {
    label: "作业1 / Blackjack cloud",
    pcdUrl: "/models/example.pcd",
    targetRadius: 5.2,
    preRotation: [-Math.PI/2, 0, 0],
    positionOffset: [-0.15, 0.05, 0],
    colorMode: "white",
    transitionSeed: 2,
  },
  "/homework2": {
    label: "作业2 / Bridge cube",
    pcdUrl: "/models/cube.pcd",
    targetRadius: 5.1,
    preRotation: [Math.PI / 2, -0.15, -0.22],
    positionOffset: [0.05, -0.1, 0],
    colorMode: "rainbow",
    transitionSeed: 3,
  },
  "/contact": {
    label: "联系方式 / Contact cloud",
    pcdUrl: "/models/cube.pcd",
    targetRadius: 4.7,
    preRotation: [-0.28, -0.75, 0.05],
    positionOffset: [0.1, 0.08, 0],
    colorMode: "white",
    transitionSeed: 4,
  },
  "/settings": {
    label: "点云设置 / Calibration cube",
    pcdUrl: "/models/cube.pcd",
    targetRadius: 5,
    preRotation: [0.15, Math.PI / 4, 0.35],
    positionOffset: [0, 0, 0],
    colorMode: "default",
    transitionSeed: 5,
  },
};

export function getPointCloudConfig(pathname: string): RoutePointCloudConfig {
  const normalized = pathname === "" ? "/" : pathname;
  return PAGE_POINT_CLOUDS[normalized] ?? PAGE_POINT_CLOUDS["/"];
}
