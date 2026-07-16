/**
 * Star Line 单星动态开局分析器。
 *
 * 只分析 quota=1 的基础、无猜测传播。每层从同一份候选快照推导全部事件，
 * 稳定排序并分配 ID 后统一应用；首次出现强制星时记录整层并停止。
 * 本模块不导入正式 solver、validator 或运行时规则。
 */
import { createHash } from 'crypto';

export const DYNAMIC_OPENING_SCHEMA_VERSION = 'star-line-dynamic-opening/v1';
export const DYNAMIC_OPENING_RULE_SET = 'single-basic-locks/v1';
export const DEFAULT_MAX_OPENING_LAYERS = 5;

export const DYNAMIC_OPENING_STATUS = Object.freeze({
  FIRST_STAR: 'FIRST_STAR',
  NO_BASIC_OPENING: 'NO_BASIC_OPENING',
  SHORT_CONTRADICTION: 'SHORT_CONTRADICTION',
  OPENING_DEPTH_CAP: 'OPENING_DEPTH_CAP',
});

export const D4_TRANSFORMS = Object.freeze([
  { name: 'identity', map: (r, c, N) => [r, c] },
  { name: 'rotate90', map: (r, c, N) => [c, N - 1 - r] },
  { name: 'rotate180', map: (r, c, N) => [N - 1 - r, N - 1 - c] },
  { name: 'rotate270', map: (r, c, N) => [N - 1 - c, r] },
  { name: 'mirrorVertical', map: (r, c, N) => [r, N - 1 - c] },
  { name: 'mirrorHorizontal', map: (r, c, N) => [N - 1 - r, c] },
  { name: 'mirrorMainDiagonal', map: (r, c) => [c, r] },
  { name: 'mirrorAntiDiagonal', map: (r, c, N) => [N - 1 - c, N - 1 - r] },
]);

const REGION_LOCK_TYPES = new Set(['REGION_LOCK_ROW', 'REGION_LOCK_COLUMN']);
const LINE_LOCK_TYPES = new Set(['ROW_LOCK_REGION', 'COLUMN_LOCK_REGION']);
const STAR_EVENT_TYPES = new Set(['REGION_SINGLETON', 'ROW_SINGLETON', 'COLUMN_SINGLETON']);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function sameJson(a, b) {
  return stableJson(a) === stableJson(b);
}

export function remapRegionIds(regions) {
  const ids = new Map();
  let next = 0;
  return regions.map((rid) => {
    if (!ids.has(rid)) ids.set(rid, next++);
    return ids.get(rid);
  });
}

export function transformRegionsD4(regions, N, transformName) {
  const transform = D4_TRANSFORMS.find((entry) => entry.name === transformName);
  if (!transform) throw new Error(`未知 D4 变换: ${transformName}`);
  const out = new Array(N * N);
  for (let idx = 0; idx < regions.length; idx++) {
    const r = Math.floor(idx / N), c = idx % N;
    const [nr, nc] = transform.map(r, c, N);
    out[nr * N + nc] = regions[idx];
  }
  return remapRegionIds(out);
}

function validateInput(N, regions, quota, maxLayers) {
  if (!Number.isInteger(N) || N < 1) throw new Error(`N 必须为正整数，实际 ${N}`);
  if (!Array.isArray(regions) || regions.length !== N * N) {
    throw new Error(`regions 长度必须为 N*N，实际 ${regions?.length ?? 'non-array'}`);
  }
  if (quota !== 1) throw new Error(`动态开局分析器仅支持 quota=1，实际 ${quota}`);
  if (!Number.isInteger(maxLayers) || maxLayers < 1) throw new Error(`maxLayers 必须为正整数，实际 ${maxLayers}`);
}

function buildTopology(N, regions) {
  const rows = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => r * N + c));
  const columns = Array.from({ length: N }, (_, c) => Array.from({ length: N }, (_, r) => r * N + c));
  const regionMap = new Map();
  regions.forEach((rid, idx) => {
    if (!regionMap.has(rid)) regionMap.set(rid, []);
    regionMap.get(rid).push(idx);
  });
  const regionIds = [...regionMap.keys()].sort((a, b) => a - b);
  const regionCells = new Map(regionIds.map((rid) => [rid, [...regionMap.get(rid)].sort((a, b) => a - b)]));
  return { rows, columns, regionIds, regionCells };
}

function eventStableKey(event) {
  return stableJson({
    type: event.type,
    sourceUnit: event.sourceUnit,
    candidateCells: event.candidateCells,
    outputCells: event.outputCells,
    starCells: event.starCells,
    witnessExcludedCells: event.witnessExcludedCells,
  });
}

function parentIdsForWitnesses(witnesses, provenance) {
  const ids = new Set();
  for (const cell of witnesses) {
    for (const id of provenance.get(cell) ?? []) ids.add(id);
  }
  return [...ids].sort();
}

function makeEvent(type, sourceUnit, candidateCells, outputCells, starCells, witnessExcludedCells, provenance) {
  const witnesses = sortedUnique(witnessExcludedCells);
  return {
    id: null,
    layer: null,
    type,
    sourceUnit,
    candidateCells: sortedUnique(candidateCells),
    outputCells: sortedUnique(outputCells),
    starCells: sortedUnique(starCells),
    witnessExcludedCells: witnesses,
    parentEventIds: parentIdsForWitnesses(witnesses, provenance),
  };
}

function candidateCells(cells, live) {
  return cells.filter((idx) => live.has(idx));
}

function orderValues(values, scanOrder) {
  return scanOrder === 'reverse' ? [...values].reverse() : [...values];
}

function deriveLayerEvents(N, regions, topology, live, provenance, layer, scanOrder = 'normal') {
  const raw = [];
  const { rows, columns, regionIds, regionCells } = topology;

  for (const rid of orderValues(regionIds, scanOrder)) {
    const cells = regionCells.get(rid);
    const candidates = candidateCells(cells, live);
    const source = { kind: 'REGION', index: rid };
    if (candidates.length === 0) {
      raw.push(makeEvent('SHORT_CONTRADICTION', source, [], [], [], cells, provenance));
      continue;
    }
    if (candidates.length === 1) {
      raw.push(makeEvent('REGION_SINGLETON', source, candidates, [], candidates, cells.filter((idx) => !live.has(idx)), provenance));
    }
    const candidateRows = new Set(candidates.map((idx) => Math.floor(idx / N)));
    if (candidateRows.size === 1) {
      const row = [...candidateRows][0];
      const output = rows[row].filter((idx) => regions[idx] !== rid && live.has(idx));
      if (output.length > 0) {
        const witnesses = cells.filter((idx) => !live.has(idx) && Math.floor(idx / N) !== row);
        raw.push(makeEvent('REGION_LOCK_ROW', source, candidates, output, [], witnesses, provenance));
      }
    }
    const candidateColumns = new Set(candidates.map((idx) => idx % N));
    if (candidateColumns.size === 1) {
      const column = [...candidateColumns][0];
      const output = columns[column].filter((idx) => regions[idx] !== rid && live.has(idx));
      if (output.length > 0) {
        const witnesses = cells.filter((idx) => !live.has(idx) && idx % N !== column);
        raw.push(makeEvent('REGION_LOCK_COLUMN', source, candidates, output, [], witnesses, provenance));
      }
    }
  }

  for (const row of orderValues(Array.from({ length: N }, (_, i) => i), scanOrder)) {
    const cells = rows[row];
    const candidates = candidateCells(cells, live);
    const source = { kind: 'ROW', index: row };
    if (candidates.length === 0) {
      raw.push(makeEvent('SHORT_CONTRADICTION', source, [], [], [], cells, provenance));
      continue;
    }
    if (candidates.length === 1) {
      raw.push(makeEvent('ROW_SINGLETON', source, candidates, [], candidates, cells.filter((idx) => !live.has(idx)), provenance));
    }
    const candidateRegions = new Set(candidates.map((idx) => regions[idx]));
    if (candidateRegions.size === 1) {
      const rid = [...candidateRegions][0];
      const output = regionCells.get(rid).filter((idx) => Math.floor(idx / N) !== row && live.has(idx));
      if (output.length > 0) {
        const witnesses = cells.filter((idx) => !live.has(idx) && regions[idx] !== rid);
        raw.push(makeEvent('ROW_LOCK_REGION', source, candidates, output, [], witnesses, provenance));
      }
    }
  }

  for (const column of orderValues(Array.from({ length: N }, (_, i) => i), scanOrder)) {
    const cells = columns[column];
    const candidates = candidateCells(cells, live);
    const source = { kind: 'COLUMN', index: column };
    if (candidates.length === 0) {
      raw.push(makeEvent('SHORT_CONTRADICTION', source, [], [], [], cells, provenance));
      continue;
    }
    if (candidates.length === 1) {
      raw.push(makeEvent('COLUMN_SINGLETON', source, candidates, [], candidates, cells.filter((idx) => !live.has(idx)), provenance));
    }
    const candidateRegions = new Set(candidates.map((idx) => regions[idx]));
    if (candidateRegions.size === 1) {
      const rid = [...candidateRegions][0];
      const output = regionCells.get(rid).filter((idx) => idx % N !== column && live.has(idx));
      if (output.length > 0) {
        const witnesses = cells.filter((idx) => !live.has(idx) && regions[idx] !== rid);
        raw.push(makeEvent('COLUMN_LOCK_REGION', source, candidates, output, [], witnesses, provenance));
      }
    }
  }

  const unique = new Map();
  for (const event of raw) unique.set(eventStableKey(event), event);
  const events = [...unique.values()].sort((a, b) => eventStableKey(a).localeCompare(eventStableKey(b)));
  events.forEach((event, index) => {
    event.layer = layer;
    event.id = `L${String(layer).padStart(2, '0')}E${String(index).padStart(2, '0')}`;
  });
  return events;
}

function applyLayer(events, live, provenance) {
  for (const event of events) {
    for (const cell of event.outputCells) {
      if (!live.has(cell)) continue;
      live.delete(cell);
    }
  }
  for (const event of events) {
    for (const cell of event.outputCells) {
      if (!provenance.has(cell)) provenance.set(cell, new Set());
      provenance.get(cell).add(event.id);
    }
  }
}

function buildCausalSpine(events, firstStarEventIds) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const memo = new Map();
  function bestPath(id, visiting = new Set()) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return [];
    const event = byId.get(id);
    if (!event) return [];
    const nextVisiting = new Set(visiting).add(id);
    const parentPaths = event.parentEventIds.map((parentId) => bestPath(parentId, nextVisiting));
    parentPaths.sort((a, b) => b.length - a.length || a.join('|').localeCompare(b.join('|')));
    const path = [...(parentPaths[0] ?? []), id];
    memo.set(id, path);
    return path;
  }
  const paths = firstStarEventIds.map((id) => bestPath(id));
  paths.sort((a, b) => b.length - a.length || a.join('|').localeCompare(b.join('|')));
  return paths[0] ?? [];
}

function normalizedMechanismType(type) {
  if (type === 'REGION_LOCK_ROW' || type === 'REGION_LOCK_COLUMN') return 'REGION_LOCK_AXIS';
  if (type === 'ROW_LOCK_REGION' || type === 'COLUMN_LOCK_REGION') return 'LINE_LOCK_REGION';
  if (type === 'ROW_SINGLETON' || type === 'COLUMN_SINGLETON') return 'LINE_SINGLETON';
  return type;
}

function classifyTrace(status, layers, events, firstStarEventIds, causalSpine) {
  if (status !== DYNAMIC_OPENING_STATUS.FIRST_STAR) {
    return { openingTier: null, openingTierLabel: status, openingFamily: status };
  }
  const starEvents = firstStarEventIds.map((id) => events.find((event) => event.id === id)).filter(Boolean);
  const starLayer = starEvents[0]?.layer ?? 0;
  const endpoint = starEvents.some((event) => event.type === 'REGION_SINGLETON')
    ? 'REGION_SINGLETON' : 'LINE_SINGLETON';
  if (starLayer === 0) {
    return { openingTier: 0, openingTierLabel: 'DIRECT', openingFamily: `DIRECT_TO_${endpoint}` };
  }
  const preLayers = layers.filter((layer) => layer.index < starLayer);
  const regionLockLayerCount = preLayers.filter((layer) => layer.eventIds.some((id) => {
    const event = events.find((entry) => entry.id === id);
    return event && REGION_LOCK_TYPES.has(event.type);
  })).length;
  let openingFamily;
  if (regionLockLayerCount > 0) {
    openingFamily = regionLockLayerCount === 1
      ? `REGION_LOCK_CHAIN_1_TO_${endpoint}`
      : `REGION_LOCK_CHAIN_2PLUS_TO_${endpoint}`;
  } else {
    openingFamily = `MIXED_LOCK_CHAIN_TO_${endpoint}`;
  }
  const spineEvents = causalSpine.map((id) => events.find((event) => event.id === id)).filter(Boolean);
  const hasRegionLock = spineEvents.some((event) => REGION_LOCK_TYPES.has(event.type));
  const hasLineLock = spineEvents.some((event) => LINE_LOCK_TYPES.has(event.type));
  const openingTier = hasRegionLock && hasLineLock ? 3 : starLayer === 1 ? 1 : 2;
  return {
    openingTier,
    openingTierLabel: openingTier === 3 ? 'MIXED_BASIC_RULES' : `LOCK_DEPTH_${openingTier}`,
    openingFamily,
  };
}

function classifyOpeningCluster(status, events, firstStarEventIds, firstStarCells, openingFamily) {
  if (status === DYNAMIC_OPENING_STATUS.NO_BASIC_OPENING) return 'NO_BASIC_OPENING';
  if (status !== DYNAMIC_OPENING_STATUS.FIRST_STAR) return status;
  if (openingFamily.endsWith('TO_REGION_SINGLETON')) return 'REGION_SINGLETON_OPENING';
  if (openingFamily.endsWith('TO_LINE_SINGLETON')) return 'LINE_SINGLETON_OPENING';
  if (openingFamily.startsWith('MIXED_') || firstStarCells.length > 1) return 'MIXED_OR_PARALLEL_OPENING';
  const firstStarTypes = new Set(firstStarEventIds
    .map((id) => events.find((event) => event.id === id)?.type)
    .filter(Boolean));
  if (firstStarTypes.has('REGION_SINGLETON')) return 'REGION_SINGLETON_OPENING';
  if (firstStarTypes.has('ROW_SINGLETON') || firstStarTypes.has('COLUMN_SINGLETON')) return 'LINE_SINGLETON_OPENING';
  return 'OTHER_OPENING';
}

function runTrace(N, regions, { maxLayers = DEFAULT_MAX_OPENING_LAYERS, scanOrder = 'normal' } = {}) {
  const topology = buildTopology(N, regions);
  const live = new Set(Array.from({ length: N * N }, (_, idx) => idx));
  const provenance = new Map();
  const layers = [];
  const allEvents = [];
  let status = DYNAMIC_OPENING_STATUS.NO_BASIC_OPENING;
  let firstStarCells = [];
  let firstStarEventIds = [];

  for (let layer = 0; layer < maxLayers; layer++) {
    const startCandidateCount = live.size;
    const events = deriveLayerEvents(N, regions, topology, live, provenance, layer, scanOrder);
    if (events.length === 0) {
      status = DYNAMIC_OPENING_STATUS.NO_BASIC_OPENING;
      break;
    }
    allEvents.push(...events);
    const contradictions = events.filter((event) => event.type === 'SHORT_CONTRADICTION');
    const starEvents = events.filter((event) => STAR_EVENT_TYPES.has(event.type));
    applyLayer(events, live, provenance);
    layers.push({
      index: layer,
      startCandidateCount,
      endCandidateCount: live.size,
      eventIds: events.map((event) => event.id),
    });
    if (contradictions.length > 0) {
      status = DYNAMIC_OPENING_STATUS.SHORT_CONTRADICTION;
      break;
    }
    if (starEvents.length > 0) {
      status = DYNAMIC_OPENING_STATUS.FIRST_STAR;
      firstStarCells = sortedUnique(starEvents.flatMap((event) => event.starCells));
      firstStarEventIds = starEvents.map((event) => event.id);
      break;
    }
    if (layer === maxLayers - 1) {
      status = DYNAMIC_OPENING_STATUS.OPENING_DEPTH_CAP;
      break;
    }
  }

  const causalSpine = buildCausalSpine(allEvents, firstStarEventIds);
  const classification = classifyTrace(status, layers, allEvents, firstStarEventIds, causalSpine);
  const openingCluster = classifyOpeningCluster(
    status, allEvents, firstStarEventIds, firstStarCells, classification.openingFamily,
  );
  const firstStarLayer = status === DYNAMIC_OPENING_STATUS.FIRST_STAR
    ? allEvents.find((event) => firstStarEventIds.includes(event.id))?.layer ?? null
    : null;
  return {
    status,
    propagationDepth: layers.length,
    preStarLayers: firstStarLayer ?? null,
    layers,
    events: allEvents,
    firstStarCells,
    firstStarEventIds,
    firstStarLayer,
    causalSpine,
    causalSpineTypes: causalSpine.map((id) => normalizedMechanismType(allEvents.find((event) => event.id === id)?.type)),
    openingCluster,
    ...classification,
  };
}

function traceSignaturePayload(N, quota, maxLayers, regions, trace) {
  return {
    schemaVersion: DYNAMIC_OPENING_SCHEMA_VERSION,
    ruleSet: DYNAMIC_OPENING_RULE_SET,
    traceMode: 'FIRST_STAR',
    N,
    quota,
    maxLayers,
    regions,
    status: trace.status,
    propagationDepth: trace.propagationDepth,
    layers: trace.layers,
    events: trace.events,
    firstStarCells: trace.firstStarCells,
    firstStarEventIds: trace.firstStarEventIds,
    openingTier: trace.openingTier,
    openingCluster: trace.openingCluster,
    openingFamily: trace.openingFamily,
    causalSpine: trace.causalSpine,
  };
}

function compareTraceForReplay(trace) {
  return {
    status: trace.status,
    propagationDepth: trace.propagationDepth,
    layers: trace.layers,
    events: trace.events,
    firstStarCells: trace.firstStarCells,
    firstStarEventIds: trace.firstStarEventIds,
  };
}

export function validateDynamicOpeningTrace(N, regions, trace, options = {}) {
  const quota = options.quota ?? 1;
  const maxLayers = options.maxLayers ?? DEFAULT_MAX_OPENING_LAYERS;
  const canonicalRegions = remapRegionIds(regions);
  const errors = [];
  try {
    validateInput(N, canonicalRegions, quota, maxLayers);
    const replay = runTrace(N, canonicalRegions, { maxLayers, scanOrder: options.scanOrder ?? 'normal' });
    if (!sameJson(compareTraceForReplay(trace), compareTraceForReplay(replay))) {
      errors.push('按层回放结果与原 trace 不一致');
    }
    for (const event of trace.events ?? []) {
      if (event.parentEventIds.some((parentId) => {
        const parent = trace.events.find((entry) => entry.id === parentId);
        return !parent || parent.layer >= event.layer;
      })) errors.push(`${event.id}: parent 必须来自更早层`);
    }
    if (trace.status === DYNAMIC_OPENING_STATUS.FIRST_STAR) {
      const firstLayer = trace.firstStarLayer ?? trace.events.find((event) => event.starCells.length > 0)?.layer;
      if (trace.layers.some((layer) => layer.index > firstLayer)) errors.push('默认首星模式在首星层后继续传播');
      const finalLayer = trace.layers.at(-1);
      const finalStars = trace.events.filter((event) => event.layer === finalLayer?.index && event.starCells.length > 0);
      if (finalStars.length === 0) errors.push('FIRST_STAR 状态缺少首星层事件');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

function conservativeNearDuplicateKey(analysis) {
  const eventById = new Map(analysis.events.map((event) => [event.id, event]));
  return stableJson({
    openingFamily: analysis.openingFamily,
    propagationDepth: analysis.propagationDepth,
    causalSpineTypes: analysis.causalSpine.map((id) => normalizedMechanismType(eventById.get(id)?.type)),
    layers: analysis.layers.map((layer) => layer.eventIds.map((id) => normalizedMechanismType(eventById.get(id)?.type)).sort()),
  });
}

export function compareDynamicOpenings(a, b) {
  const exact = a.exactDynamicSignature === b.exactDynamicSignature;
  const sameFamily = a.openingFamily === b.openingFamily;
  const nearDuplicate = !exact && sameFamily
    && a.propagationDepth === b.propagationDepth
    && conservativeNearDuplicateKey(a) === conservativeNearDuplicateKey(b);
  return { exact, sameFamily, nearDuplicate };
}

export function findDynamicOpeningMatches(target, entries) {
  const exactDuplicates = [], sameFamilyLevels = [], nearDuplicates = [];
  for (const entry of entries) {
    const analysis = entry.analysis ?? entry.dynamicOpening ?? entry;
    if (!analysis || analysis === target) continue;
    const comparison = compareDynamicOpenings(target, analysis);
    const id = entry.id ?? entry.levelId ?? entry.candidateId ?? 'unknown';
    if (comparison.exact) exactDuplicates.push(id);
    if (comparison.sameFamily) sameFamilyLevels.push(id);
    if (comparison.nearDuplicate) nearDuplicates.push(id);
  }
  return {
    exactDuplicates: exactDuplicates.sort(),
    sameFamilyLevels: sameFamilyLevels.sort(),
    nearDuplicates: nearDuplicates.sort(),
  };
}

export function summarizeDynamicOpeningLayers(analysis) {
  const byId = new Map(analysis.events.map((event) => [event.id, event]));
  return analysis.layers.map((layer) => ({
    layer: layer.index,
    events: layer.eventIds.map((id) => {
      const event = byId.get(id);
      return {
        id,
        type: event.type,
        candidates: event.candidateCells.length,
        excluded: event.outputCells.length,
        stars: event.starCells,
        parents: event.parentEventIds,
      };
    }),
  }));
}

export function analyzeDynamicOpening(N, regions, options = {}) {
  const quota = options.quota ?? 1;
  const maxLayers = options.maxLayers ?? DEFAULT_MAX_OPENING_LAYERS;
  const scanOrder = options.scanOrder ?? 'normal';
  validateInput(N, regions, quota, maxLayers);
  const canonicalInputRegions = remapRegionIds(regions);
  const originalTrace = runTrace(N, canonicalInputRegions, { maxLayers, scanOrder });
  const traceValidation = validateDynamicOpeningTrace(N, canonicalInputRegions, originalTrace, { quota, maxLayers, scanOrder });

  const variants = D4_TRANSFORMS.map((transform) => {
    const transformedRegions = transformRegionsD4(canonicalInputRegions, N, transform.name);
    const trace = runTrace(N, transformedRegions, { maxLayers, scanOrder });
    const validation = validateDynamicOpeningTrace(N, transformedRegions, trace, { quota, maxLayers, scanOrder });
    const signature = stableJson(traceSignaturePayload(N, quota, maxLayers, transformedRegions, trace));
    return { transform: transform.name, trace, validation, signature };
  });
  variants.sort((a, b) => a.signature.localeCompare(b.signature) || a.transform.localeCompare(b.transform));
  const chosen = variants[0];
  const exactDynamicSignature = chosen.signature;
  const exactDynamicHash = createHash('sha256').update(exactDynamicSignature).digest('hex');

  return {
    schemaVersion: DYNAMIC_OPENING_SCHEMA_VERSION,
    ruleSet: DYNAMIC_OPENING_RULE_SET,
    traceMode: 'FIRST_STAR',
    quota,
    maxLayers,
    ...originalTrace,
    traceValidation,
    d4Validation: {
      valid: variants.every((variant) => variant.validation.valid),
      failures: variants.filter((variant) => !variant.validation.valid).map((variant) => ({
        transform: variant.transform,
        errors: variant.validation.errors,
      })),
    },
    chosenTransform: chosen.transform,
    exactDynamicSignature,
    exactDynamicHash,
  };
}

export function cellLabel(idx, N) {
  return `r${Math.floor(idx / N) + 1}c${idx % N + 1}`;
}
