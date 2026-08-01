// Production Edge Puzzle Foundation · 正交方格 Edge 坐标模型（纯函数）
// 仅适用于正交方格；不是异形棋盘或通用平面图引擎。
// 规范坐标：{ orientation: 'horizontal' | 'vertical', row, col }
// 稳定 key：h:<row>:<col> / v:<row>:<col>
// 行列从 0 开始；N×N 棋盘指 N 个 cell。
// 横边：row ∈ [0, N]，col ∈ [0, N-1]（row=0 上边界，row=N 下边界）
// 竖边：row ∈ [0, N-1]，col ∈ [0, N]（col=0 左边界，col=N 右边界）

export const EDGE_ORIENTATIONS = Object.freeze({
  horizontal: 'horizontal',
  vertical: 'vertical',
});

/**
 * 判断是否为合法 orientation 字符串。
 */
export function isHorizontalEdge(edge) {
  return !!edge && edge.orientation === EDGE_ORIENTATIONS.horizontal;
}

export function isVerticalEdge(edge) {
  return !!edge && edge.orientation === EDGE_ORIENTATIONS.vertical;
}

export function isValidOrientation(orientation) {
  return orientation === EDGE_ORIENTATIONS.horizontal
    || orientation === EDGE_ORIENTATIONS.vertical;
}

/**
 * 判断一条边是否在 N×N cell 棋盘内。
 */
export function isEdgeInBounds(edge, n) {
  if (!edge || !Number.isInteger(n) || n <= 0 || !isValidOrientation(edge.orientation)) {
    return false;
  }
  const { row, col } = edge;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (isHorizontalEdge(edge)) {
    return row >= 0 && row <= n && col >= 0 && col < n;
  }
  return row >= 0 && row < n && col >= 0 && col <= n;
}

/**
 * 生成稳定 key：'h:<row>:<col>' / 'v:<row>:<col>'。
 * 对非法边返回 null。
 */
export function edgeKey(edge, n = null) {
  if (!edge || !isValidOrientation(edge.orientation)) return null;
  const { row, col } = edge;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (n !== null && !isEdgeInBounds(edge, n)) return null;
  return `${isHorizontalEdge(edge) ? 'h' : 'v'}:${row}:${col}`;
}

/**
 * 解析稳定 key。非法格式返回 null。
 */
export function parseEdgeKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^([hv]):(\d+):(\d+)$/.exec(key);
  if (!match) return null;
  return {
    orientation: match[1] === 'h' ? EDGE_ORIENTATIONS.horizontal : EDGE_ORIENTATIONS.vertical,
    row: Number(match[2]),
    col: Number(match[3]),
  };
}

/**
 * 边的两个端点（vertex：{ row, col }）。
 * 横边 (h,r,c)：端点 (r,c) 与 (r,c+1)。
 * 竖边 (v,r,c)：端点 (r,c) 与 (r+1,c)。
 * 非法边返回 null。
 */
export function edgeEndpoints(edge) {
  if (!edge || !isValidOrientation(edge.orientation)) return null;
  const { row, col } = edge;
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (isHorizontalEdge(edge)) {
    return [{ row, col }, { row, col: col + 1 }];
  }
  return [{ row, col }, { row: row + 1, col }];
}

export function vertexKey(vertex) {
  if (!vertex || !Number.isInteger(vertex.row) || !Number.isInteger(vertex.col)) return null;
  return `${vertex.row}:${vertex.col}`;
}

/**
 * 顶点相邻的边（棋盘内部/边界顶点按几何位置裁剪）。
 * 顶点 (r,c) 的候选相邻边由「边的端点包含该顶点」推导（冻结公式）：
 *   h:(r, c-1) —— 端点 (r,c-1)-(r,c)，经过 (r,c)（顶点左侧横边）
 *   h:(r, c)   —— 端点 (r,c)-(r,c+1)，经过 (r,c)（顶点右侧横边）
 *   v:(r-1, c) —— 端点 (r-1,c)-(r,c)，经过 (r,c)（顶点上方竖边）
 *   v:(r, c)   —— 端点 (r,c)-(r+1,c)，经过 (r,c)（顶点下方竖边）
 * 返回包含 { edge, slot, key } 的数组，顺序固定。
 */
export function edgesAtVertex(vertex, n) {
  if (!vertex || !Number.isInteger(vertex.row) || !Number.isInteger(vertex.col)) return [];
  const { row, col } = vertex;
  const candidates = [
    { edge: { orientation: EDGE_ORIENTATIONS.horizontal, row, col: col - 1 }, slot: 'left' },
    { edge: { orientation: EDGE_ORIENTATIONS.horizontal, row, col }, slot: 'right' },
    { edge: { orientation: EDGE_ORIENTATIONS.vertical, row: row - 1, col }, slot: 'top' },
    { edge: { orientation: EDGE_ORIENTATIONS.vertical, row, col }, slot: 'bottom' },
  ];
  return candidates
    .filter(({ edge }) => isEdgeInBounds(edge, n))
    .map(({ edge, slot }) => ({ edge, slot, key: edgeKey(edge, n) }));
}

/**
 * N×N cell 棋盘的边总数：横边 n(n+1) + 竖边 n(n+1) = 2n(n+1)。
 * 10×10 → 220；11×11 → 264。
 */
export function edgeCount(n) {
  if (!Number.isInteger(n) || n <= 0) return 0;
  return 2 * n * (n + 1);
}

/**
 * 列举 N×N 棋盘全部边的 key（确定性顺序：横边按 row,col 升序，随后竖边按 row,col 升序）。
 */
export function listAllEdgeKeys(n) {
  const keys = [];
  for (let row = 0; row <= n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      keys.push(edgeKey({ orientation: EDGE_ORIENTATIONS.horizontal, row, col }, n));
    }
  }
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col <= n; col += 1) {
      keys.push(edgeKey({ orientation: EDGE_ORIENTATIONS.vertical, row, col }, n));
    }
  }
  return keys;
}

/**
 * 解析一组 key；返回 { keys, invalid, duplicates }。
 * 合法 key 统一规范化为规范形式（如 'h:02:1' 规范化为 'h:2:1'）；
 * 去重基于规范化 key。
 */
export function resolveEdgeKeys(rawKeys, n) {
  const keys = [];
  const invalid = [];
  const seen = new Set();
  const duplicates = [];
  for (const raw of rawKeys || []) {
    const edge = parseEdgeKey(raw);
    if (!edge || !isEdgeInBounds(edge, n)) {
      invalid.push(raw);
      continue;
    }
    const key = edgeKey(edge, n);
    if (seen.has(key)) {
      duplicates.push(key);
      continue;
    }
    seen.add(key);
    keys.push(key);
  }
  return { keys, invalid, duplicates };
}
