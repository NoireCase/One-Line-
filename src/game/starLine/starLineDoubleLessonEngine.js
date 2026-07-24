/**
 * Star Double 教学引擎 (Proof-Driven)。
 *
 * 所有 proof 从当前盘面动态计算，不读 solution，不读固定坐标白名单。
 * 纯函数，可在浏览器和 Node.js 中运行。
 */

// ═══ 工具 ═══

function eightNeighbors(idx, N) {
  const row = Math.floor(idx / N), col = idx % N;
  const cells = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) cells.push(nr * N + nc);
    }
  }
  return cells.sort((a, b) => a - b);
}

function boardStateHash(state) {
  const sig = state.map(c => (c === 'S' ? 'S' : c === 'X' ? 'X' : 'U')).join('');
  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function readState(gridData) {
  return gridData.map(c => (c?.isStarred ? 'S' : c?.isMarkedX ? 'X' : 'U'));
}

// ═══ 单位构建 ═══

function buildUnits(N, regions) {
  const rows = Array.from({ length: N }, (_, i) => ({
    kind: 'row', index: i, key: `row:${i}`,
    cells: Array.from({ length: N }, (_, c) => i * N + c),
  }));
  const cols = Array.from({ length: N }, (_, i) => ({
    kind: 'col', index: i, key: `col:${i}`,
    cells: Array.from({ length: N }, (_, r) => r * N + i),
  }));
  const rids = [...new Set(regions)].sort((a, b) => a - b);
  const regionUnits = rids.map(rid => ({
    kind: 'region', index: rid, key: `region:${rid}`,
    cells: regions.map((r, idx) => (r === rid ? idx : -1)).filter(idx => idx >= 0),
  }));
  return [...rows, ...cols, ...regionUnits];
}

function buildBlocks(N) {
  const blocks = [];
  for (let r = 0; r < N - 1; r++)
    for (let c = 0; c < N - 1; c++)
      blocks.push({ key: `block:${r}:${c}`, cells: [r*N+c, r*N+c+1, (r+1)*N+c, (r+1)*N+c+1] });
  return blocks;
}

function unitStats(state, unit, quota) {
  const stars = unit.cells.filter(c => state[c] === 'S');
  const unknown = unit.cells.filter(c => state[c] === 'U');
  return { stars: stars.length, unknown: unknown.length, remaining: quota - stars.length, candidates: unknown };
}

// ═══ Proof 类型 ═══

/**
 * ADJACENCY_EXCLUSION: 已有星 → 排除八邻格
 */
function findAdjacencyProofs(state, units, _blocks, N, _quota) {
  const proofs = [];
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== 'S') continue;
    const neighbors = eightNeighbors(i, N);
    const targets = neighbors.filter(n => state[n] === 'U');
    if (targets.length === 0) continue;
    proofs.push({
      technique: 'adjacency-exclusion',
      action: 'eliminate',
      premises: { starCell: i },
      involvedUnits: units.filter(u => u.cells.includes(i)).map(u => u.key),
      observationCells: [i, ...neighbors],
      evidenceCells: [i],
      derivedTargets: targets,
      starCell: i,
      fullNeighborSet: neighbors,
    });
  }
  return proofs;
}

/**
 * QUOTA_SATURATED：某单位已满 quota → 排除其余格
 */
function findQuotaProofs(state, units, _blocks, _N, quota) {
  const proofs = [];
  for (const unit of units) {
    const stats = unitStats(state, unit, quota);
    if (stats.remaining === 0 && stats.unknown > 0) {
      proofs.push({
        technique: 'quota-saturated',
        action: 'eliminate',
        premises: { unit: unit.key, starCount: stats.stars, quota },
        involvedUnits: [unit.key],
        observationCells: [...unit.cells],
        evidenceCells: unit.cells.filter(c => state[c] === 'S'),
        derivedTargets: stats.candidates,
      });
    }
  }
  return proofs;
}

/**
 * REMAINING_CAPACITY：剩余空位 == 剩余星数 → 放星
 */
function findRemainingProofs(state, units, _blocks, _N, quota) {
  const proofs = [];
  for (const unit of units) {
    const stats = unitStats(state, unit, quota);
    if (stats.remaining > 0 && stats.unknown === stats.remaining) {
      proofs.push({
        technique: 'remaining-capacity',
        action: 'place-star',
        premises: { unit: unit.key, remaining: stats.remaining, candidates: stats.candidates.length },
        involvedUnits: [unit.key],
        observationCells: [...unit.cells],
        evidenceCells: unit.cells.filter(c => state[c] === 'S' || state[c] === 'X'),
        derivedTargets: stats.candidates,
      });
    }
  }
  return proofs;
}

/**
 * TWO_BY_TWO_CAPACITY：某单位候选格被 2×2 覆盖 → 排除块中其他格
 */
function findTwoByTwoProofs(state, units, blocks, N, quota) {
  const proofs = [];
  for (const unit of units) {
    const stats = unitStats(state, unit, quota);
    if (stats.remaining < 1 || stats.remaining > 2 || stats.candidates.length === 0) continue;
    const candSet = new Set(stats.candidates);

    // Find blocks that are star-free and overlap with candidates
    const eligible = blocks.filter(b =>
      b.cells.every(c => state[c] !== 'S') && b.cells.some(c => candSet.has(c))
    );

    // For remaining=1: find ONE block that covers all candidates
    if (stats.remaining === 1) {
      for (const block of eligible) {
        if (stats.candidates.every(c => block.cells.includes(c))) {
          const targets = block.cells.filter(c => state[c] === 'U' && !candSet.has(c));
          if (targets.length > 0) {
            proofs.push({
              technique: 'two-by-two-capacity',
              action: 'eliminate',
              premises: { unit: unit.key, remaining: 1, blockKey: block.key },
              involvedUnits: [unit.key, block.key],
              observationCells: [...new Set([...unit.cells, ...block.cells])],
              evidenceCells: [...block.cells],
              derivedTargets: targets,
            });
          }
        }
      }
    }

    // For remaining=2: find TWO disjoint blocks that cover all candidates
    if (stats.remaining === 2) {
      for (let i = 0; i < eligible.length; i++) {
        for (let j = i + 1; j < eligible.length; j++) {
          if (eligible[i].cells.some(c => eligible[j].cells.includes(c))) continue;
          const union = new Set([...eligible[i].cells, ...eligible[j].cells]);
          if (stats.candidates.every(c => union.has(c))) {
            const targets = [...union].filter(c => state[c] === 'U' && !candSet.has(c));
            if (targets.length > 0) {
              proofs.push({
                technique: 'two-by-two-capacity',
                action: 'eliminate',
                premises: { unit: unit.key, remaining: 2, blocks: [eligible[i].key, eligible[j].key] },
                involvedUnits: [unit.key, eligible[i].key, eligible[j].key],
                observationCells: [...new Set([...unit.cells, ...eligible[i].cells, ...eligible[j].cells])],
                evidenceCells: [...eligible[i].cells, ...eligible[j].cells],
                derivedTargets: targets,
              });
            }
          }
        }
      }
    }
  }
  return proofs;
}

/**
 * CONFINED_CAPACITY：两个不同类单位有相同剩余quota，
 * 源单位候选全部在目标单位内 → 排除目标单位外部候选
 */
function findConfinedProofs(state, units, _blocks, _N, quota) {
  const proofs = [];
  const allUnits = units; // already includes rows, cols, regions

  for (const src of allUnits) {
    const srcStats = unitStats(state, src, quota);
    if (srcStats.remaining < 1 || srcStats.candidates.length === 0) continue;

    for (const tgt of allUnits) {
      if (src.kind === tgt.kind) continue;
      const tgtStats = unitStats(state, tgt, quota);
      if (tgtStats.remaining !== srcStats.remaining) continue;

      // Check: all src candidates are in tgt
      if (!srcStats.candidates.every(c => tgt.cells.includes(c))) continue;

      // External candidates in tgt can be eliminated
      const srcSet = new Set(srcStats.candidates);
      const targets = tgtStats.candidates.filter(c => !srcSet.has(c));
      if (targets.length === 0) continue;

      proofs.push({
        technique: 'confined-capacity',
        action: 'eliminate',
        premises: {
          sourceUnit: src.key, targetUnit: tgt.key,
          remaining: srcStats.remaining,
          sourceCandidates: srcStats.candidates,
          containmentWitness: 'all-source-candidates-in-target',
        },
        involvedUnits: [src.key, tgt.key],
        observationCells: [...new Set([...src.cells, ...tgt.cells])],
        evidenceCells: [...srcStats.candidates],
        derivedTargets: targets,
      });
    }
  }
  return proofs;
}

// ═══ 主入口 ═══

const PROOF_FINDERS = [
  { technique: 'quota-saturated', fn: findQuotaProofs, priority: 10 },
  { technique: 'adjacency-exclusion', fn: findAdjacencyProofs, priority: 20 },
  { technique: 'remaining-capacity', fn: findRemainingProofs, priority: 30 },
  { technique: 'confined-capacity', fn: findConfinedProofs, priority: 40 },
  { technique: 'two-by-two-capacity', fn: findTwoByTwoProofs, priority: 50 },
];

/**
 * 从当前盘面获取所有合法 proof。
 * 不读 solution，不读固定坐标。
 *
 * @param {object} level - { N, regions, starsPerRow }
 * @param {object[]} gridData - [{ isStarred, isMarkedX }]
 * @param {string[]} [allowedTechniques] - 可选技术白名单
 * @returns {object[]} proofs
 */
export function findAllProofs(level, gridData, allowedTechniques = null) {
  const N = level.N || level.boardSize || 8;
  const regions = level.regions;
  const quota = level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 2;
  const state = readState(gridData);

  const units = buildUnits(N, regions);
  const blocks = buildBlocks(N);
  const techSet = allowedTechniques ? new Set(allowedTechniques) : null;

  const allProofs = [];
  for (const finder of PROOF_FINDERS) {
    if (techSet && !techSet.has(finder.technique)) continue;
    const proofs = finder.fn(state, units, blocks, N, quota);
    for (const p of proofs) {
      allProofs.push({ ...p, boardStateHash: boardStateHash(state) });
    }
  }

  // Dedup: same action + same derivedTargets
  const seen = new Set();
  return allProofs.filter(p => {
    const key = `${p.action}:${[...p.derivedTargets].sort((a,b)=>a-b).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 从 proof 提取观察范围、依据和目标——全部动态计算。
 */
export function deriveTargets(proof) {
  return {
    observationCells: proof.observationCells || [],
    evidenceCells: proof.evidenceCells || [],
    targetCells: proof.derivedTargets || [],
    action: proof.action,
    technique: proof.technique,
  };
}

/**
 * 验证玩家操作是否符合 proof 预期。
 */
export function validatePlayerAction(proof, cellIndex, action, gridData) {
  if (!proof) return { valid: false, reason: '无可用 proof' };
  if (proof.action !== action) return { valid: false, reason: `期望 ${proof.action}，得到 ${action}` };
  if (!proof.derivedTargets.includes(cellIndex)) return { valid: false, reason: '不在目标格中' };
  return { valid: true };
}

/**
 * 按技术类型筛选 proof。
 */
export function filterProofsByTechnique(proofs, technique) {
  return proofs.filter(p => p.technique === technique);
}

/**
 * 获取与特定单位相关的 proof。
 */
export function filterProofsByUnit(proofs, unitKey) {
  return proofs.filter(p => p.involvedUnits?.includes(unitKey));
}

// ═══ 教学指标 ═══

/**
 * 自动计算教学指标（需要在 Node.js 环境中调用 human logic engine）。
 * 浏览器端使用简化版。
 */
export function computeTeachingMetrics(level, gridData) {
  const allProofs = findAllProofs(level, gridData);
  const N = level.N || 8;

  return {
    availableProofCount: allProofs.length,
    techniquesAvailable: [...new Set(allProofs.map(p => p.technique))],
    adjacencyProofs: allProofs.filter(p => p.technique === 'adjacency-exclusion').length,
    quotaProofs: allProofs.filter(p => p.technique === 'quota-saturated').length,
    remainingProofs: allProofs.filter(p => p.technique === 'remaining-capacity').length,
    twoByTwoProofs: allProofs.filter(p => p.technique === 'two-by-two-capacity').length,
    confinedProofs: allProofs.filter(p => p.technique === 'confined-capacity').length,
  };
}

/**
 * 检查 SETUP 动作是否使用了已学规则。
 */
export function validateSetupAction(proofs, cellIndex, action, prerequisiteTechniques) {
  const matchingProof = proofs.find(p =>
    p.derivedTargets.includes(cellIndex) &&
    p.action === action &&
    prerequisiteTechniques.includes(p.technique)
  );
  if (!matchingProof) return { valid: false, reason: `无法用已学规则证明此操作` };
  return { valid: true, proof: matchingProof };
}
