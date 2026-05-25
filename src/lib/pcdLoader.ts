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

  const positions = new Float32Array(points * 3);
  let colors: Float32Array | null = null;
  if (rIdx !== -1 || redIdx !== -1) {
    colors = new Float32Array(points * 3);
  }

  let validPoints = 0;
  for (let i = headerEnd; i < lines.length && validPoints < points; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(/\s+/);
    const px = parseFloat(values[xIdx]);
    const py = parseFloat(values[yIdx]);
    const pz = parseFloat(values[zIdx]);

    if (isNaN(px) || isNaN(py) || isNaN(pz)) continue;

    const idx = validPoints * 3;
    positions[idx] = px;
    positions[idx + 1] = py;
    positions[idx + 2] = pz;

    // 处理颜色
    if (colors) {
      if (rIdx !== -1) {
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
      } else if (redIdx !== -1) {
        colors[idx] = parseFloat(values[redIdx]) / 255;
        colors[idx + 1] = parseFloat(values[greenIdx]) / 255;
        colors[idx + 2] = parseFloat(values[blueIdx]) / 255;
      }
    }

    validPoints++;
  }

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
 */
export async function loadPCD(url: string): Promise<PCDData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load PCD file: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const textDecoder = new TextDecoder();
  const text = textDecoder.decode(new Uint8Array(buffer));
  const lines = text.split("\n");

  const header = parseHeader(lines);

  if (header.data === "binary") {
    return parseBinary(buffer, header);
  } else {
    return parseASCII(lines, header);
  }
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

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  const maxDim = Math.max(dx, dy, dz);
  const scale = maxDim > 0 ? (targetRadius * 2) / maxDim : 1;

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
