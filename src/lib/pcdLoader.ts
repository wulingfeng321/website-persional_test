/**
 * PCD (Point Cloud Data) 文件解析器
 * 支持 ASCII 和 Binary 格式的 PCD 文件
 */

export interface PCDData {
  positions: Float32Array;
  colors: Float32Array | null;
  normals: Float32Array | null;
  count: number;
}

// 加载进度回调类型
export type ProgressCallback = (loaded: number, total: number) => void;

/**
 * 解析 PCD 文件头
 */
function parseHeader(lines: string[]): {
  fields: string[];
  size: number[];
  type: string[];
  count: number[];
  width: number;
  height: number;
  points: number;
  data: string;
  headerEnd: number;
} {
  const result: Record<string, string> = {};
  let headerEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("DATA")) {
      result.DATA = line.split(/\s+/)[1];
      headerEnd = i + 1;
      break;
    }
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      result[parts[0]] = parts.slice(1).join(" ");
    }
  }

  return {
    fields: (result.FIELDS || "x y z").split(/\s+/),
    size: (result.SIZE || "4 4 4").split(/\s+/).map(Number),
    type: (result.TYPE || "F F F").split(/\s+/),
    count: (result.COUNT || "1 1 1").split(/\s+/).map(Number),
    width: parseInt(result.WIDTH || "1"),
    height: parseInt(result.HEIGHT || "1"),
    points: parseInt(result.POINTS || "0"),
    data: result.DATA || "ascii",
    headerEnd,
  };
}

/**
 * 解析 ASCII 格式的 PCD 数据
 */
function parseASCII(lines: string[], header: ReturnType<typeof parseHeader>): PCDData {
  const { fields, points, headerEnd } = header;
  const xIdx = fields.indexOf("x");
  const yIdx = fields.indexOf("y");
  const zIdx = fields.indexOf("z");
  const rIdx = fields.indexOf("rgb");
  const redIdx = fields.indexOf("red");
  const greenIdx = fields.indexOf("green");
  const blueIdx = fields.indexOf("blue");

  console.log(`[PCD Parser] 字段索引: x=${xIdx}, y=${yIdx}, z=${zIdx}, rgb=${rIdx}`);
  console.log(`[PCD Parser] 预期点数: ${points}, 数据起始行: ${headerEnd}`);

  const positions = new Float32Array(points * 3);
  let colors: Float32Array | null = null;
  if (rIdx !== -1 || redIdx !== -1) {
    colors = new Float32Array(points * 3);
  }

  let validPoints = 0;
  let skippedPoints = 0;
  const dataLines = lines.length - headerEnd;

  for (let i = headerEnd; i < lines.length && validPoints < points; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(/\s+/);

    // 确保有足够的字段
    if (values.length < Math.max(xIdx, yIdx, zIdx) + 1) {
      skippedPoints++;
      continue;
    }

    const px = parseFloat(values[xIdx]);
    const py = parseFloat(values[yIdx]);
    const pz = parseFloat(values[zIdx]);

    if (isNaN(px) || isNaN(py) || isNaN(pz)) {
      skippedPoints++;
      continue;
    }

    const idx = validPoints * 3;
    positions[idx] = px;
    positions[idx + 1] = py;
    positions[idx + 2] = pz;

    // 处理颜色
    if (colors) {
      if (rIdx !== -1 && rIdx < values.length) {
        // rgb 字段可能是打包的 float 或单独的值
        const rgbVal = parseFloat(values[rIdx]);
        if (rgbVal > 1) {
          // 打包的 RGB float
          const packed = new Float32Array([rgbVal]);
          const view = new DataView(packed.buffer);
          const intRGB = view.getUint32(0, false);
          colors[idx] = ((intRGB >> 16) & 0xff) / 255;
          colors[idx + 1] = ((intRGB >> 8) & 0xff) / 255;
          colors[idx + 2] = (intRGB & 0xff) / 255;
        } else {
          colors[idx] = rgbVal;
          colors[idx + 1] = parseFloat(values[rIdx + 1] || "0");
          colors[idx + 2] = parseFloat(values[rIdx + 2] || "0");
        }
      } else if (redIdx !== -1 && redIdx < values.length) {
        colors[idx] = parseFloat(values[redIdx]) / 255;
        colors[idx + 1] = parseFloat(values[greenIdx]) / 255;
        colors[idx + 2] = parseFloat(values[blueIdx]) / 255;
      }
    }

    validPoints++;

    // 每 100000 点输出一次进度
    if (validPoints % 100000 === 0) {
      console.log(`[PCD Parser] 已解析 ${validPoints} / ${points} 点`);
    }
  }

  console.log(`[PCD Parser] 解析完成: 有效点=${validPoints}, 跳过点=${skippedPoints}, 数据行=${dataLines}`);

  return {
    positions: positions.slice(0, validPoints * 3),
    colors: colors ? colors.slice(0, validPoints * 3) : null,
    normals: null,
    count: validPoints,
  };
}

/**
 * 从 ArrayBuffer 解析 Binary PCD
 */
function parseBinary(buffer: ArrayBuffer, header: ReturnType<typeof parseHeader>): PCDData {
  const { fields, size, type, count: fieldCount, points, headerEnd } = header;

  // 找到 DATA binary 行之后的实际二进制数据起始位置
  const textDecoder = new TextDecoder();
  const headerText = textDecoder.decode(new Uint8Array(buffer));
  const dataStart = headerText.indexOf("DATA binary\n");
  const binaryOffset = dataStart !== -1 ? dataStart + "DATA binary\n".length : 0;

  const dataView = new DataView(buffer, binaryOffset);
  const xIdx = fields.indexOf("x");
  const yIdx = fields.indexOf("y");
  const zIdx = fields.indexOf("z");

  // 计算每点字节数
  let pointSize = 0;
  for (let f = 0; f < fields.length; f++) {
    pointSize += size[f] * fieldCount[f];
  }

  const positions = new Float32Array(points * 3);
  let offset = 0;

  for (let p = 0; p < points; p++) {
    let fieldOffset = 0;
    for (let f = 0; f < fields.length; f++) {
      const fieldSize = size[f];
      const fc = fieldCount[f];

      for (let c = 0; c < fc; c++) {
        const byteOffset = offset + fieldOffset + c * fieldSize;

        if (f === xIdx) {
          positions[p * 3] = dataView.getFloat32(byteOffset, true);
        } else if (f === yIdx) {
          positions[p * 3 + 1] = dataView.getFloat32(byteOffset, true);
        } else if (f === zIdx) {
          positions[p * 3 + 2] = dataView.getFloat32(byteOffset, true);
        }
      }
      fieldOffset += fieldSize * fc;
    }
    offset += pointSize;
  }

  return {
    positions,
    colors: null,
    normals: null,
    count: points,
  };
}

/**
 * 加载并解析 PCD 文件
 * @param url PCD 文件路径（相对于 public 目录）
 * @param onProgress 加载进度回调
 */
export async function loadPCD(url: string, onProgress?: ProgressCallback, signal?: AbortSignal): Promise<PCDData> {
  console.log(`[PCD Loader] 开始加载: ${url}`);

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load PCD file: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  // 读取响应体
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) {
      throw new DOMException("PCD loading aborted", "AbortError");
    }
    chunks.push(value);
    loaded += value.length;
    if (onProgress && total > 0) {
      onProgress(loaded, total);
    }
  }

  // 合并 chunks
  const buffer = new ArrayBuffer(loaded);
  const uint8 = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    uint8.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(`[PCD Loader] 文件下载完成: ${(loaded / 1024 / 1024).toFixed(2)} MB`);

  const textDecoder = new TextDecoder();
  const text = textDecoder.decode(uint8);
  const lines = text.split("\n");

  console.log(`[PCD Loader] 文件行数: ${lines.length}`);

  const header = parseHeader(lines);
  console.log(`[PCD Loader] 头信息:`, {
    fields: header.fields,
    points: header.points,
    data: header.data,
    headerEnd: header.headerEnd,
  });

  let result: PCDData;

  if (header.data === "binary") {
    console.log("[PCD Loader] 解析 binary 格式...");
    result = parseBinary(buffer, header);
  } else {
    console.log("[PCD Loader] 解析 ascii 格式...");
    result = parseASCII(lines, header);
  }

  console.log(`[PCD Loader] 解析完成: ${result.count} 个点`);
  return result;
}

/**
 * 将 PCD 数据归一化到指定范围（居中 + 缩放）
 */
export function normalizePCDData(
  data: PCDData,
  targetRadius: number = 5
): PCDData {
  const { positions, count } = data;

  // 计算包围盒
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    minX = Math.min(minX, positions[i3]);
    minY = Math.min(minY, positions[i3 + 1]);
    minZ = Math.min(minZ, positions[i3 + 2]);
    maxX = Math.max(maxX, positions[i3]);
    maxY = Math.max(maxY, positions[i3 + 1]);
    maxZ = Math.max(maxZ, positions[i3 + 2]);
  }

  console.log("[PCD Normalizer] 原始包围盒:", {
    x: [minX.toFixed(2), maxX.toFixed(2)],
    y: [minY.toFixed(2), maxY.toFixed(2)],
    z: [minZ.toFixed(2), maxZ.toFixed(2)],
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const maxDim = Math.max(dx, dy, dz);
  const scale = maxDim > 0 ? (targetRadius * 2) / maxDim : 1;

  console.log("[PCD Normalizer] 归一化参数:", {
    center: [cx.toFixed(2), cy.toFixed(2), cz.toFixed(2)],
    maxDim: maxDim.toFixed(2),
    scale: scale.toFixed(4),
    targetRadius,
  });

  const normalized = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    normalized[i3] = (positions[i3] - cx) * scale;
    normalized[i3 + 1] = (positions[i3 + 1] - cy) * scale;
    normalized[i3 + 2] = (positions[i3 + 2] - cz) * scale;
  }

  // 验证归一化后的范围
  let nMinX = Infinity, nMinY = Infinity, nMinZ = Infinity;
  let nMaxX = -Infinity, nMaxY = -Infinity, nMaxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    nMinX = Math.min(nMinX, normalized[i3]);
    nMinY = Math.min(nMinY, normalized[i3 + 1]);
    nMinZ = Math.min(nMinZ, normalized[i3 + 2]);
    nMaxX = Math.max(nMaxX, normalized[i3]);
    nMaxY = Math.max(nMaxY, normalized[i3 + 1]);
    nMaxZ = Math.max(nMaxZ, normalized[i3 + 2]);
  }

  console.log("[PCD Normalizer] 归一化后包围盒:", {
    x: [nMinX.toFixed(2), nMaxX.toFixed(2)],
    y: [nMinY.toFixed(2), nMaxY.toFixed(2)],
    z: [nMinZ.toFixed(2), nMaxZ.toFixed(2)],
  });

  return {
    ...data,
    positions: normalized,
  };
}
