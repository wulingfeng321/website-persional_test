# PCD 点云文件导入说明

## 快速开始

### 第一步：放置 PCD 文件

将你的 `.pcd` 文件复制到项目的 `public/models/` 目录下：

```bash
cp your-pointcloud.pcd ~/persional_test/public/models/
```

目录结构示例：

```
persional_test/
├── public/
│   └── models/
│       ├── example.pcd          # 项目自带的示例文件
│       ├── bunny.pcd            # 你的点云文件
│       └── scene.pcd            # 可以放多个
└── src/
```

### 第二步：修改配置

编辑 `src/components/PointCloudBackground.tsx`，找到第 11 行的配置项：

```typescript
const PCD_URL: string | null = null;  // 当前使用程序化生成的点云
```

修改为你的文件路径：

```typescript
const PCD_URL: string | null = "/models/bunny.pcd";
```

### 第三步：查看效果

保存文件后，开发服务器会自动热更新。刷新浏览器即可看到你的点云作为网站背景。

---

## 支持的 PCD 格式

### 数据格式

| 格式 | 支持情况 | 说明 |
|------|----------|------|
| ASCII | 支持 | 文本格式，便于调试 |
| Binary | 支持 | 体积更小，加载更快 |
| Binary Compressed | 不支持 | 需要转换后使用 |

### 字段支持

| 字段 | 必需 | 说明 |
|------|------|------|
| `x` | 是 | X 坐标 |
| `y` | 是 | Y 坐标 |
| `z` | 是 | Z 坐标 |
| `rgb` | 否 | 打包的 RGB 颜色值 |
| `red` / `green` / `blue` | 否 | 分离的 RGB 颜色值（0-255） |

### PCD 文件头示例

```
# .PCD v0.7 - Point Cloud Data file format
VERSION 0.7
FIELDS x y z rgb
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 10000
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS 10000
DATA ascii
```

---

## 如何获取 PCD 文件

### 方法一：从 PCL 工具导出

如果你使用 Point Cloud Library (PCL)：

```cpp
#include <pcl/io/pcd_io.h>
#include <pcl/point_types.h>

pcl::PointCloud<pcl::PointXYZRGB>::Ptr cloud(new pcl::PointCloud<pcl::PointXYZRGB>);
// ... 加载或处理点云 ...
pcl::io::savePCDFileASCII("output.pcd", *cloud);
```

### 方法二：从 Python 转换

使用 `open3d` 或 `numpy` 将其他格式转为 PCD：

```python
import numpy as np

# 从 XYZ 文本文件转换
data = np.loadtxt("points.xyz")  # N x 3 的数组

with open("output.pcd", "w") as f:
    f.write("# .PCD v0.7\n")
    f.write("VERSION 0.7\n")
    f.write("FIELDS x y z\n")
    f.write("SIZE 4 4 4\n")
    f.write("TYPE F F F\n")
    f.write("COUNT 1 1 1\n")
    f.write(f"WIDTH {len(data)}\n")
    f.write("HEIGHT 1\n")
    f.write("VIEWPOINT 0 0 0 1 0 0 0\n")
    f.write(f"POINTS {len(data)}\n")
    f.write("DATA ascii\n")
    for p in data:
        f.write(f"{p[0]} {p[1]} {p[2]}\n")
```

### 方法三：从 LAS/PLY/OBJ 转换

使用 CloudCompare（免费开源软件）：

1. 打开 CloudCompare
2. 导入你的点云文件（支持 LAS、PLY、OBJ、STL 等）
3. File → Save As → 选择 PCD 格式

### 方法四：在线数据集

一些公开的 PCD 点云数据集：

- Stanford 3D Scanning Repository（斯坦福兔子等经典模型）
- PCL 官方测试数据（`pcl/test/` 目录下）

---

## 性能优化建议

### 点云降采样

如果点云点数过多（超过 10 万），建议降采样以保证 60 FPS：

```python
import numpy as np

data = np.loadtxt("large_cloud.xyz")
# 随机采样 10000 个点
indices = np.random.choice(len(data), 10000, replace=False)
sampled = data[indices]
np.savetxt("downsampled.xyz", sampled)
```

### 在 PCL 中降采样

```cpp
#include <pcl/filters/voxel_grid.h>

pcl::VoxelGrid<pcl::PointXYZ> voxel;
voxel.setInputCloud(cloud);
voxel.setLeafSize(0.01f, 0.01f, 0.01f);  // 调整体素大小
voxel.filter(*cloud_filtered);
pcl::io::savePCDFileASCII("downsampled.pcd", *cloud_filtered);
```

### 点数参考

| 场景 | 建议点数 | 预期帧率 |
|------|----------|----------|
| 桌面端背景 | 5000-15000 | 60 FPS |
| 移动端背景 | 2000-5000 | 30 FPS |
| 展示用（非背景） | 50000+ | 30-60 FPS |

---

## 配置项说明

在 `src/components/PointCloudBackground.tsx` 中可调整以下参数：

```typescript
// PCD 文件路径，null 则使用程序化生成的点云
const PCD_URL: string | null = "/models/example.pcd";
```

在 `normalizePCDData` 调用中可调整缩放半径：

```typescript
const normalized = normalizePCDData(data, 5);  // 第二个参数是目标半径，默认 5
```

点云渲染参数（在 `pointsMaterial` 中）：

```typescript
<pointsMaterial
  size={0.03}              // 点的大小，PCD 文件可适当调大到 0.05-0.1
  vertexColors             // 使用顶点颜色
  transparent
  opacity={0.8}            // 透明度
  sizeAttenuation          // 近大远小
  depthWrite={false}
  blending={THREE.AdditiveBlending}  // 叠加混合，产生发光效果
/>
```

---

## 常见问题

**Q: 加载后看不到点云？**
- 检查浏览器控制台是否有错误
- 确认 PCD 文件路径正确（相对于 `public/` 目录）
- 尝试增大 `size` 参数（如 `0.1`）
- 确认点云坐标范围没有过大或过小

**Q: 点云太大/太小？**
- 调整 `normalizePCDData(data, radius)` 的 `radius` 参数
- 值越小点云越紧凑，越大越分散

**Q: 没有颜色怎么办？**
- 程序会自动生成青蓝色渐变作为默认颜色
- 如需自定义颜色，修改 `generateDefaultColors` 函数

**Q: Binary Compressed 格式不支持？**
- 使用 CloudCompare 或 PCL 工具转换为 ASCII 或 Binary 格式：
  ```bash
  pcl_convert_pcd_ascii_binary input.pcd output.pcd 0
  ```
  最后一个参数：0=ASCII, 1=Binary, 2=Binary Compressed
