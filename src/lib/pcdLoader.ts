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
    if (onProgress) {
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
 * 将点云数据归一化到指定范围（居中 + 按最大欧几里得距离缩放）
 */
export function normalizePCDData(
  data: PCDData,
  targetRadius: number = 5
): PCDData {
  const { positions, count } = data;

  // 计算质心
  let sumX = 0, sumY = 0, sumZ = 0;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    sumX += positions[i3];
    sumY += positions[i3 + 1];
    sumZ += positions[i3 + 2];
  }
  const cx = sumX / count;
  const cy = sumY / count;
  const cz = sumZ / count;

  // 计算最大欧几里得距离
  let maxR = 0;
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const dx = positions[i3] - cx;
    const dy = positions[i3 + 1] - cy;
    const dz = positions[i3 + 2] - cz;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > maxR) maxR = r;
  }

  const scale = maxR > 0 ? targetRadius / maxR : 1;

  console.log("[PCD Normalizer]", {
    count,
    center: [cx.toFixed(2), cy.toFixed(2), cz.toFixed(2)],
    maxRadius: maxR.toFixed(2),
    scale: scale.toFixed(6),
    targetRadius,
  });

  const normalized = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    normalized[i3] = (positions[i3] - cx) * scale;
    normalized[i3 + 1] = (positions[i3 + 1] - cy) * scale;
    normalized[i3 + 2] = (positions[i3 + 2] - cz) * scale;
  }

  return {
    ...data,
    positions: normalized,
  };
}

/**
 * 加载原始二进制 .bin 点云文件（raw Float32 XYZ，无头部）
 * 文件格式：连续的 Float32 值 [x0,y0,z0, x1,y1,z1, ...]
 */
export async function loadBin(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<PCDData> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load bin file: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (onProgress && total > 0) {
    // Stream with progress
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to get response reader");

    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }

    const buffer = new ArrayBuffer(loaded);
    const uint8 = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
      uint8.set(chunk, offset);
      offset += chunk.length;
    }

    const positions = new Float32Array(buffer);
    return { positions, colors: null, normals: null, count: positions.length / 3 };
  }

  // Simple path without progress
  const buffer = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const positions = new Float32Array(buffer);
  if (onProgress) onProgress(buffer.byteLength, buffer.byteLength);
  return { positions, colors: null, normals: null, count: positions.length / 3 };
}
