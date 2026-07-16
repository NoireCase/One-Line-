/** Star Line 单星动态开局分析器固定测试。 */
import { readFileSync } from 'fs';
import { STAR_LINE_LEVELS } from '../src/data/starLineLevels.js';
import { d4AlignedRegionJaccard } from './star-line-candidate-signatures.mjs';
import {
  analyzeDynamicOpening,
  compareDynamicOpenings,
  DYNAMIC_OPENING_STATUS,
  remapRegionIds,
  transformRegionsD4,
  validateDynamicOpeningTrace,
} from './star-line-dynamic-opening.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (error) { console.log(`  ✗ ${name}: ${error.message}`); failed++; }
}
function assert(condition, message = 'assertion failed') { if (!condition) throw new Error(message); }

function level(id) {
  const found = STAR_LINE_LEVELS.find((entry) => entry.id === id);
  if (!found) throw new Error(`缺少 fixture 关卡 ${id}`);
  return found;
}
function analyzeLevel(id, options = {}) {
  const fixture = level(id);
  return analyzeDynamicOpening(fixture.N, fixture.regions, { quota: 1, ...options });
}
function eventById(analysis, id) { return analysis.events.find((event) => event.id === id); }

// 保留整改前玩家 Lv.60 的固定结构，确保原始问题链仍被动态分析器稳定识别。
const lv60 = {
  N: 10,
  regions: [9,3,3,3,6,6,7,7,7,7,9,9,9,3,0,6,7,7,7,7,8,9,3,3,0,6,7,5,5,7,8,9,3,3,0,6,7,5,7,7,4,4,3,0,0,0,7,5,5,2,4,4,0,0,0,2,2,2,5,2,0,4,0,0,0,2,2,2,2,2,0,0,0,0,0,2,2,1,1,1,0,0,1,1,0,1,2,2,2,1,0,0,0,1,1,1,1,1,1,1],
};
const lv60Analysis = analyzeDynamicOpening(lv60.N, lv60.regions);

console.log('\n═══ Star Line 动态开局固定测试 ═══');

test('1. Lv.60 两层区域锁列后在第三层得到 r2c3', () => {
  assert(lv60Analysis.status === DYNAMIC_OPENING_STATUS.FIRST_STAR, lv60Analysis.status);
  assert(lv60Analysis.propagationDepth === 3, `depth=${lv60Analysis.propagationDepth}`);
  assert(lv60Analysis.firstStarLayer === 2, `firstStarLayer=${lv60Analysis.firstStarLayer}`);
  assert(JSON.stringify(lv60Analysis.firstStarCells) === '[12]', `first=${lv60Analysis.firstStarCells}`);
  const layerTypes = lv60Analysis.layers.map((layer) => layer.eventIds.map((id) => eventById(lv60Analysis, id).type));
  assert(layerTypes[0].includes('REGION_LOCK_COLUMN'), `L0=${layerTypes[0]}`);
  assert(layerTypes[1].includes('REGION_LOCK_COLUMN'), `L1=${layerTypes[1]}`);
  assert(layerTypes[2].includes('REGION_SINGLETON'), `L2=${layerTypes[2]}`);
  assert(lv60Analysis.openingFamily === 'REGION_LOCK_CHAIN_2PLUS_TO_REGION_SINGLETON', lv60Analysis.openingFamily);
  assert(lv60Analysis.openingCluster === 'REGION_SINGLETON_OPENING', lv60Analysis.openingCluster);
  assert(JSON.stringify(lv60Analysis.causalSpineTypes) === '["REGION_LOCK_AXIS","REGION_LOCK_AXIS","REGION_SINGLETON"]',
    `spine=${lv60Analysis.causalSpineTypes}`);
});

test('2. 旋转 90°后 exact signature/hash 一致', () => {
  const rotated = transformRegionsD4(lv60.regions, lv60.N, 'rotate90');
  const analysis = analyzeDynamicOpening(lv60.N, rotated);
  assert(analysis.exactDynamicSignature === lv60Analysis.exactDynamicSignature, 'signature 不一致');
  assert(analysis.exactDynamicHash === lv60Analysis.exactDynamicHash, 'hash 不一致');
});

test('3. 镜像后 exact signature/hash 一致', () => {
  const mirrored = transformRegionsD4(lv60.regions, lv60.N, 'mirrorVertical');
  const analysis = analyzeDynamicOpening(lv60.N, mirrored);
  assert(analysis.exactDynamicSignature === lv60Analysis.exactDynamicSignature, 'signature 不一致');
  assert(analysis.exactDynamicHash === lv60Analysis.exactDynamicHash, 'hash 不一致');
});

test('4. region id 重排后结果不变', () => {
  const relabeled = lv60.regions.map((rid) => 1000 - rid * 17);
  const analysis = analyzeDynamicOpening(lv60.N, relabeled);
  assert(analysis.exactDynamicSignature === lv60Analysis.exactDynamicSignature, 'signature 受 region id 影响');
  assert(analysis.openingFamily === lv60Analysis.openingFamily, 'family 受 region id 影响');
  assert(JSON.stringify(analysis.firstStarCells) === JSON.stringify(lv60Analysis.firstStarCells), '首星变化');
});

const multiEntryRegions = [
  0,2,2,2,2,
  2,2,2,3,3,
  2,2,3,3,3,
  4,4,3,3,3,
  4,4,4,4,1,
];

test('5. 同层多个入口不依赖扫描顺序', () => {
  const normal = analyzeDynamicOpening(5, multiEntryRegions, { scanOrder: 'normal' });
  const reverse = analyzeDynamicOpening(5, multiEntryRegions, { scanOrder: 'reverse' });
  assert(normal.exactDynamicSignature === reverse.exactDynamicSignature, 'exact 受扫描顺序影响');
  assert(JSON.stringify(normal.events) === JSON.stringify(reverse.events), '事件排序受扫描顺序影响');
  assert(normal.layers[0].eventIds.length > 2, 'fixture 没有形成多个同层入口');
});

test('6. 候选数量轻微差异仍归同一连续锁定 family', () => {
  const a = analyzeLevel('star-lv-69');
  const b = lv60Analysis;
  const counts = (analysis) => analysis.causalSpine
    .map((id) => eventById(analysis, id))
    .filter((event) => event.type.startsWith('REGION_LOCK_'))
    .map((event) => event.candidateCells.length);
  assert(a.openingFamily === b.openingFamily, `${a.openingFamily} != ${b.openingFamily}`);
  assert(JSON.stringify(counts(a)) !== JSON.stringify(counts(b)), `候选数量未形成变体: ${counts(a)}`);
});

test('7. 静态形状不同但逻辑链相同', () => {
  const aLevel = level('star-lv-69');
  const a = analyzeDynamicOpening(aLevel.N, aLevel.regions);
  assert(JSON.stringify(remapRegionIds(aLevel.regions)) !== JSON.stringify(remapRegionIds(lv60.regions)), '静态形状意外相同');
  assert(a.exactDynamicSignature !== lv60Analysis.exactDynamicSignature, '不同棋盘不应 exact 相同');
  assert(a.openingFamily === lv60Analysis.openingFamily, '同逻辑链未归同 family');
});

test('8. 静态较相似但逻辑链不同', () => {
  const otherLevel = level('star-lv-31');
  const other = analyzeDynamicOpening(otherLevel.N, otherLevel.regions);
  const similarity = d4AlignedRegionJaccard(otherLevel.regions, lv60.regions, lv60.N);
  assert(similarity > 0.79, `静态相似度不足: ${similarity}`);
  assert(other.openingFamily !== lv60Analysis.openingFamily, '不同逻辑链被归为同 family');
});

test('9. 无基础开局返回 NO_BASIC_OPENING', () => {
  const analysis = analyzeLevel('star-lv-03');
  assert(analysis.status === DYNAMIC_OPENING_STATUS.NO_BASIC_OPENING, analysis.status);
  assert(analysis.openingCluster === 'NO_BASIC_OPENING', analysis.openingCluster);
  assert(analysis.firstStarCells.length === 0, '不应产生首星');
});

test('10. 同层多个强制星全部记录后停止', () => {
  const analysis = analyzeDynamicOpening(5, multiEntryRegions);
  assert(analysis.status === DYNAMIC_OPENING_STATUS.FIRST_STAR, analysis.status);
  assert(JSON.stringify(analysis.firstStarCells) === '[0,24]', `first=${analysis.firstStarCells}`);
  assert(analysis.openingCluster === 'REGION_SINGLETON_OPENING', analysis.openingCluster);
  assert(analysis.layers.length === 1, `layers=${analysis.layers.length}`);
});

test('11. 默认模式不记录首星后的邻接或容量排除', () => {
  const forbidden = new Set([
    'STAR_ADJACENCY_EXCLUSION',
    'REGION_CAPACITY_EXCLUSION',
    'ROW_CAPACITY_EXCLUSION',
    'COLUMN_CAPACITY_EXCLUSION',
  ]);
  assert(!lv60Analysis.events.some((event) => forbidden.has(event.type)), '出现落星后事件');
  assert(lv60Analysis.layers.at(-1).index === lv60Analysis.firstStarLayer, '首星层后仍有传播');
});

const contradictionRegions = [
  0,2,2,2,
  0,2,2,2,
  1,3,3,3,
  1,3,3,3,
];

test('12. SHORT_CONTRADICTION 仅由基础排除产生且模块不引用 solver', () => {
  const analysis = analyzeDynamicOpening(4, contradictionRegions);
  assert(analysis.status === DYNAMIC_OPENING_STATUS.SHORT_CONTRADICTION, analysis.status);
  assert(analysis.events.some((event) => event.type === 'SHORT_CONTRADICTION'), '缺少矛盾事件');
  const source = readFileSync(new URL('./star-line-dynamic-opening.mjs', import.meta.url), 'utf-8');
  assert(!source.includes('starLineSolver'), '动态分析器不应引用正式 solver');
  assert(!/\bMRV\b|backtrack|guess/i.test(source), '动态分析器不应包含猜测或回溯');
});

test('13. 所有 fixture trace 都通过按层回放校验', () => {
  const fixtures = [
    { N: lv60.N, regions: lv60.regions, analysis: lv60Analysis },
    { N: 5, regions: multiEntryRegions, analysis: analyzeDynamicOpening(5, multiEntryRegions) },
    { N: 4, regions: contradictionRegions, analysis: analyzeDynamicOpening(4, contradictionRegions) },
  ];
  for (const fixture of fixtures) {
    assert(fixture.analysis.traceValidation.valid, fixture.analysis.traceValidation.errors.join('; '));
    const replay = validateDynamicOpeningTrace(fixture.N, fixture.regions, fixture.analysis);
    assert(replay.valid, replay.errors.join('; '));
  }
});

test('14. 保守 near duplicate 只报告同 family 同事件骨架', () => {
  const a = analyzeLevel('star-lv-69');
  const comparison = compareDynamicOpenings(a, lv60Analysis);
  assert(comparison.exact === false, '不同静态棋盘不应 exact');
  assert(comparison.sameFamily === true, '应为同 family');
  assert(typeof comparison.nearDuplicate === 'boolean', 'near duplicate 必须是保守布尔报告');
});

test('15. 达到层数上限且未出现首星时返回 OPENING_DEPTH_CAP', () => {
  const analysis = analyzeDynamicOpening(lv60.N, lv60.regions, { maxLayers: 1 });
  assert(analysis.status === DYNAMIC_OPENING_STATUS.OPENING_DEPTH_CAP, analysis.status);
  assert(analysis.layers.length === 1, `layers=${analysis.layers.length}`);
  assert(analysis.firstStarCells.length === 0, '层数截断不应伪造首星');
});

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
