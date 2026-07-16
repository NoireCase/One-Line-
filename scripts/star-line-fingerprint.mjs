/**
 * Star Line 开局指纹 helper。
 *
 * 目标：刻画"玩家开局体验"的结构特征，用于识别
 * "数学不同、玩家体验相同"的关卡。
 *
 * 指纹字段：
 * - areaProfile          排序区域面积轮廓
 * - minRegionArea        最小区域面积
 * - minRegionCount       最小面积区域数量
 * - minRegionQuadrants   最小面积区域质心所在象限（TL/TR/BL/BR，排序去重）
 * - singletonCells       面积为 1 的区域格位置（天然开局锚点，排序）
 * - initialForcedStars   开局约束传播的强制星位（排序）
 * - fingerprint          以上字段的规范字符串
 *
 * 所有字段与 region label 无关（基于结构），同一 regions 多次计算结果稳定。
 * 本模块独立实现开局单轮传播，不修改也不依赖 solver 内部状态。
 */

function neighbors8(idx, N) {
  const r = Math.floor(idx / N), c = idx % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  }
  return out;
}

/** 区域格子分组：Map<rid, number[]> */
export function groupRegionCells(regions) {
  const groups = new Map();
  for (let i = 0; i < regions.length; i++) {
    if (!groups.has(regions[i])) groups.set(regions[i], []);
    groups.get(regions[i]).push(i);
  }
  return groups;
}

/** 质心象限：以 (N-1)/2 为分界，质心恰在分界线时归 T/L */
export function centroidQuadrant(cells, N) {
  let rSum = 0, cSum = 0;
  for (const idx of cells) {
    rSum += Math.floor(idx / N);
    cSum += idx % N;
  }
  const rMean = rSum / cells.length, cMean = cSum / cells.length;
  const half = (N - 1) / 2;
  return (rMean <= half ? 'T' : 'B') + (cMean <= half ? 'L' : 'R');
}

/**
 * 开局约束传播（独立实现，不使用 solver 内部函数）。
 * 从空盘出发，反复检查每行/列/区域：
 * 可放格数量恰好等于所需星数时全部强制放星，
 * 放星后按规则禁用同行/列/区（达到 quota 时）与八向邻格。
 * 迭代至不动点，返回强制星位（排序）。
 */
export function computeInitialForcedStars(N, regions, quota = 1) {
  const total = N * N;
  const starred = new Array(total).fill(false);
  const forbidden = new Array(total).fill(false);
  const rowCounts = new Array(N).fill(0);
  const colCounts = new Array(N).fill(0);
  const regionCounts = new Map();
  const groups = groupRegionCells(regions);
  for (const rid of groups.keys()) regionCounts.set(rid, 0);

  const rowCells = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => r * N + c));
  const colCells = Array.from({ length: N }, (_, c) => Array.from({ length: N }, (_, r) => r * N + c));

  function canPlace(idx) {
    if (starred[idx] || forbidden[idx]) return false;
    const r = Math.floor(idx / N), c = idx % N;
    if (rowCounts[r] >= quota || colCounts[c] >= quota) return false;
    if (regionCounts.get(regions[idx]) >= quota) return false;
    for (const nb of neighbors8(idx, N)) if (starred[nb]) return false;
    return true;
  }

  function place(idx) {
    starred[idx] = true;
    const r = Math.floor(idx / N), c = idx % N, rid = regions[idx];
    rowCounts[r]++;
    colCounts[c]++;
    regionCounts.set(rid, regionCounts.get(rid) + 1);
    if (rowCounts[r] >= quota) for (const i of rowCells[r]) if (!starred[i]) forbidden[i] = true;
    if (colCounts[c] >= quota) for (const i of colCells[c]) if (!starred[i]) forbidden[i] = true;
    if (regionCounts.get(rid) >= quota) for (const i of groups.get(rid)) if (!starred[i]) forbidden[i] = true;
    for (const nb of neighbors8(idx, N)) if (!starred[nb]) forbidden[nb] = true;
  }

  const forced = [];
  let changed = true;
  let contradiction = false;

  // 每次调用时实时读取该单元的已放星数，保证同一轮内计数最新
  function processUnit(cells, getCount) {
    const need = quota - getCount();
    if (need <= 0) return;
    const available = cells.filter(canPlace);
    if (available.length < need) { contradiction = true; return; }
    if (available.length === need) {
      for (const idx of available) {
        if (!canPlace(idx)) { contradiction = true; return; }
        place(idx);
        forced.push(idx);
        changed = true;
      }
    }
  }

  while (changed && !contradiction) {
    changed = false;
    for (let r = 0; r < N && !contradiction; r++) processUnit(rowCells[r], () => rowCounts[r]);
    for (let c = 0; c < N && !contradiction; c++) processUnit(colCells[c], () => colCounts[c]);
    for (const [rid, cells] of groups) {
      if (contradiction) break;
      processUnit(cells, () => regionCounts.get(rid));
    }
  }

  return { forced: [...forced].sort((a, b) => a - b), contradiction };
}

/**
 * 计算开局指纹。返回结构化对象 + 规范字符串。
 */
export function computeOpeningFingerprint(N, regions, quota = 1) {
  const groups = groupRegionCells(regions);
  const areas = [...groups.values()].map((cells) => cells.length).sort((a, b) => a - b);
  const minArea = areas[0];

  const minRegions = [...groups.values()].filter((cells) => cells.length === minArea);
  const minRegionQuadrants = [...new Set(minRegions.map((cells) => centroidQuadrant(cells, N)))].sort();

  const singletonCells = [...groups.values()]
    .filter((cells) => cells.length === 1)
    .map((cells) => cells[0])
    .sort((a, b) => a - b);

  const { forced, contradiction } = computeInitialForcedStars(N, regions, quota);

  const fingerprint = [
    'v1',
    `N${N}`,
    `q${quota}`,
    `a:${areas.join(',')}`,
    `min:${minArea}x${minRegions.length}@${minRegionQuadrants.join(',')}`,
    `s:${singletonCells.join(',') || '-'}`,
    `f:${forced.join(',') || '-'}`,
    contradiction ? 'X' : 'ok',
  ].join('|');

  return {
    version: 'v1',
    N,
    quota,
    areaProfile: areas,
    minRegionArea: minArea,
    minRegionCount: minRegions.length,
    minRegionQuadrants,
    singletonCells,
    initialForcedStars: forced,
    initialForcedCount: forced.length,
    contradiction,
    fingerprint,
  };
}
