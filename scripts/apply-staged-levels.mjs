/**
 * Apply staged candidates to formal Classic/Diagonal levels.
 *
 * Dry-run (default):
 *   npm run apply:level-candidates -- --mode classic --diff medium --keys classic:medium:109:109 --dry-run
 *
 * Write:
 *   npm run apply:level-candidates -- --mode classic --diff medium --keys classic:medium:109:109 --write
 *
 * Safety:
 *   - Default dry-run (never modifies files without --write)
 *   - Only appends to the END of the target mode/diff section
 *   - Never inserts in the middle, never reorders, never overwrites
 *   - Enforces TARGET_STRUCTURE limits (10/20/30 per difficulty)
 *   - Only supports classic and diagonal (rejects portal)
 *   - Single write session limited to 4 candidates
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// ── Parse CURATED_LEVELS array from JS source (handles nested brackets) ──
function parseCuratedLevels(raw) {
  const idx = raw.indexOf('const CURATED_LEVELS');
  if (idx < 0) return [];
  const start = raw.indexOf('[', idx);
  if (start < 0) return [];
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return JSON.parse(raw.substring(start, i + 1)); }
  }
  return [];
}
import { CLASSIC_STRUCTURE, getTargetSectionCount } from '../src/config/gameModes.js';
import { CONFIG } from '../src/game/classic/createClassicLevel.js';

// ── Apply adapters ──
const SUPPORTED_MODES = ['classic', 'diagonal'];
const APPLY_ADAPTERS = {
  classic: { ...CONFIG },
  diagonal: { ...CONFIG },
};

function getApplyAdapter(mode) {
  if (mode === 'portalClassic' || mode === 'portalCollect' || mode === 'portal' || mode === 'portal2') {
    console.error('❌ Portal candidates are not supported by apply --write yet.');
    console.error('   Reason: Portal requires a dedicated candidate schema, validator, scorer, and apply adapter.');
    process.exit(1);
  }
  if (!SUPPORTED_MODES.includes(mode)) {
    console.error(`❌ Unsupported mode: ${mode}. Only classic and diagonal are supported.`);
    process.exit(1);
  }
  return APPLY_ADAPTERS[mode];
}

// ── CLI ──
const args = process.argv.slice(2);
function opt(k, def) { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; }
function opts(k) { const result = []; for (let i = 0; i < args.length; i++) { if (args[i] === k && i + 1 < args.length) result.push(args[++i]); } return result; }

const targetMode = opt('--mode', 'classic');
const targetDiff = opt('--diff', 'medium');
const keysStr = opt('--keys', '');
const candidateKeysFromArgs = opts('--candidate-key');
const allKeys = keysStr ? keysStr.split(',').map(k => k.trim()).filter(Boolean) : [];
allKeys.push(...candidateKeysFromArgs);
const sourcePath = opt('--source', 'src/config/devLevelCandidates.generated.js');
const doWrite = args.includes('--write');

// ── Mode check ──
getApplyAdapter(targetMode);

if (!['easy', 'medium', 'hard'].includes(targetDiff)) {
  console.error(`Invalid diff: ${targetDiff}. Must be easy, medium, or hard.`);
  process.exit(1);
}
if (allKeys.length === 0) {
  console.error('--keys or --candidate-key is required.');
  process.exit(1);
}
if (allKeys.length > 4) {
  console.error(`❌ Single write session limited to 4 candidates. Got ${allKeys.length}.`);
  process.exit(1);
}

// ── Load source ──
if (!existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`);
  process.exit(1);
}

let sourceCandidates = [];
try {
  const raw = readFileSync(sourcePath, 'utf8');
  const match = raw.match(/export const DEV_LEVEL_CANDIDATES\s*=\s*(\[[\s\S]*\])\s*;/);
  if (match) sourceCandidates = JSON.parse(match[1]);
} catch (e) {
  console.error(`Failed to parse source: ${e.message}`);
  process.exit(1);
}

function candidateKey(c) { return `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx}`; }

const keyMap = new Map();
for (const c of sourceCandidates) keyMap.set(candidateKey(c), c);

const selected = [];
const missing = [];
for (const k of allKeys) {
  const c = keyMap.get(k);
  if (c) selected.push(c);
  else missing.push(k);
}

if (missing.length > 0) {
  console.error(`Keys not found in source: ${missing.join(', ')}`);
  process.exit(1);
}

// ── Validation ──
const errors = [];
const validated = [];

for (const c of selected) {
  const errs = [];
  if (c.mode !== targetMode) errs.push(`mode mismatch`);
  if (c.diff !== targetDiff) errs.push(`diff mismatch`);
  if (!c.grid || c.grid.length === 0) errs.push('missing grid');
  if (!c.path || c.path.length === 0) errs.push('missing path');
  if (!c.hiddenIndices || c.hiddenIndices.length === 0) errs.push('missing hiddenIndices');
  if (c.qualityScore == null) errs.push('missing qualityScore');
  if (c.difficultyScore == null) errs.push('missing difficultyScore');
  if (c.qualityScore < 55) errs.push(`qualityScore too low: ${c.qualityScore}`);
  if (c.similarityScore == null && c.maxSimilarity == null) errs.push('missing similarityScore');
  if (!c.archetypeTag) errs.push('missing archetypeTag');
  if (c.archetypeTag === 'UNKNOWN') errs.push('archetypeTag is UNKNOWN — candidate must have a known structure type');

  const N = c.N;
  if (c.grid && c.grid.length !== N * N) errs.push(`grid size mismatch`);
  if (c.path && c.path.length !== N * N) errs.push(`path length mismatch: ${c.path.length} !== ${N * N}`);

  // Grid validation
  if (c.grid) {
    const vals = c.grid.map(g => g.val).filter(v => v > 0);
    const unique = new Set(vals);
    if (unique.size !== N * N) errs.push('grid values not unique 1..N*N');
  }

  if (errs.length === 0) validated.push(c);
  else errors.push({ key: candidateKey(c), errors: errs });
}

if (errors.length > 0) {
  console.error('Validation errors:');
  for (const e of errors) console.error(`  ${e.key}: ${e.errors.join(', ')}`);
  process.exit(1);
}

// ── Capacity check ──
const targetLimit = getTargetSectionCount(targetDiff);
const currentSection = CLASSIC_STRUCTURE.find(s => s.diff === targetDiff);
const currentBase = currentSection ? currentSection.count : 0;

// Count existing curated levels already written
const curatedPath = 'src/data/curatedLevels.js';
let existingCurated = 0;
if (existsSync(curatedPath)) {
  try {
    const raw = readFileSync(curatedPath, 'utf8');
    const existing = parseCuratedLevels(raw);
    existingCurated = existing.filter(l => l.mode === targetMode && l.diff === targetDiff).length;
  } catch { /* ignore */ }
}

const currentTotal = currentBase + existingCurated;
const remaining = targetLimit - currentTotal;

console.log(`\n═══════════════════════════════════════`);
console.log(`Apply: ${targetMode} / ${targetDiff}`);
console.log(`═══════════════════════════════════════`);
console.log(`  正式生成数量: ${currentBase}`);
console.log(`  已追加 curated: ${existingCurated}`);
console.log(`  当前总计:     ${currentTotal}`);
console.log(`  目标上限:     ${targetLimit}`);
console.log(`  可追加数量:   ${remaining}`);
console.log(`  申请追加:     ${validated.length}`);
console.log('');

if (validated.length > remaining) {
  console.error(`❌ 超出容量: 需要 ${validated.length} 个位置，只剩 ${remaining} 个。`);
  process.exit(1);
}

// ── Future level numbers ──
const startLvl = currentTotal;
console.log('未来正式关卡编号:');
for (let i = 0; i < validated.length; i++) {
  const c = validated[i];
  const futureIdx = startLvl + i;
  const sim = c.maxSimilarity || c.similarityScore || 0;
  console.log(`  #${futureIdx + 1} (idx ${futureIdx})  seed=${c.seed}  Q=${c.qualityScore}  D=${c.difficultyScore}  sim=${sim}  arch=${c.archetypeTag}`);
}
console.log('');

// ── Similarity check ──
const highSimCandidates = validated.filter(c => (c.maxSimilarity || c.similarityScore || 0) >= 98);
const warnSimCandidates = validated.filter(c => {
  const s = c.maxSimilarity || c.similarityScore || 0;
  return s >= 95 && s < 98;
});

if (highSimCandidates.length > 0) {
  console.error(`❌ HIGH SIMILARITY: ${highSimCandidates.length} 个候选 similarity >= 98，拒绝通过。`);
  for (const c of highSimCandidates) {
    const s = c.maxSimilarity || c.similarityScore || 0;
    const st = c.similarTo;
    console.error(`   seed=${c.seed}  sim=${s}  similarTo=${st?.candidateKey || st?.seed || 'unknown'}`);
  }
  process.exit(1);
}

// On --write, sim >= 95 is also rejected (pilot stage safety)
if (doWrite && warnSimCandidates.length > 0) {
  console.error(`❌ SIMILARITY >= 95: ${warnSimCandidates.length} 个候选 similarity 过高，pilot 阶段不允许 --write。`);
  for (const c of warnSimCandidates) {
    const s = c.maxSimilarity || c.similarityScore || 0;
    const st = c.similarTo;
    console.error(`   seed=${c.seed}  sim=${s}  similarTo=${st?.candidateKey || st?.seed || 'unknown'}`);
  }
  console.error('   后续将支持 --allow-similar 标志。当前阶段请选择相似度更低的候选。');
  process.exit(1);
}

if (!doWrite && warnSimCandidates.length > 0) {
  console.log(`⚠️  SIMILARITY WARNING: ${warnSimCandidates.length} 个候选 similarity >= 95:`);
  for (const c of warnSimCandidates) {
    const s = c.maxSimilarity || c.similarityScore || 0;
    const st = c.similarTo;
    console.log(`   seed=${c.seed}  sim=${s}  similarTo=${st?.candidateKey || st?.seed || 'unknown'}`);
  }
  console.log('');
}

// ── Write ──
if (!doWrite) {
  console.log('🔍 DRY-RUN — 未修改任何文件。');
  console.log(`   确认无误后执行: npm run apply:level-candidates -- --mode ${targetMode} --diff ${targetDiff} --keys "${allKeys.join(',')}" --write`);
  console.log('');
  console.log(`✅ 校验通过: ${validated.length}/${selected.length} 个候选`);
  process.exit(0);
}

// ═══════════════════════════════════════
// --write mode
// ═══════════════════════════════════════

console.log('🔧 --write: 准备写入 curated levels...\n');

// Build curated entries
const curatedEntries = [];
for (const c of validated) {
  const entry = {
    mode: c.mode,
    diff: c.diff,
    N: c.N,
    path: c.path,
    hiddenIndices: c.hiddenIndices,
    startIndex: c.path?.[0] ?? 0,
    qualityScore: c.qualityScore,
    difficultyScore: c.difficultyScore,
    similarityScore: c.maxSimilarity || c.similarityScore || 0,
    archetypeTag: c.archetypeTag || 'UNKNOWN',
    source: {
      candidateKey: candidateKey(c),
      seed: c.seed,
      virtualIdx: c.virtualIdx || c.seed,
      generatedAt: c.generatedAt || new Date().toISOString()
    }
  };
  curatedEntries.push(entry);
}

// Read existing curated levels
let existingLevels = [];
if (existsSync(curatedPath)) {
  try {
    const raw = readFileSync(curatedPath, 'utf8');
    existingLevels = parseCuratedLevels(raw);
  } catch (e) {
    console.error(`Failed to read existing curated levels: ${e.message}`);
    process.exit(1);
  }
}

// Check for duplicates
for (const entry of curatedEntries) {
  const dup = existingLevels.find(l =>
    l.mode === entry.mode && l.diff === entry.diff &&
    l.source?.candidateKey === entry.source.candidateKey
  );
  if (dup) {
    console.error(`❌ Duplicate candidateKey already exists: ${entry.source.candidateKey}`);
    process.exit(1);
  }
}

// Check path duplication against existing curated levels
for (const entry of curatedEntries) {
  const pathStr = JSON.stringify(entry.path);
  for (const existing of existingLevels) {
    if (existing.mode === entry.mode && existing.diff === entry.diff) {
      const existingPath = JSON.stringify(existing.path);
      if (pathStr === existingPath) {
        console.error(`❌ Path identical to existing curated level (mode=${entry.mode}, diff=${entry.diff}). Refusing to add duplicate.`);
        process.exit(1);
      }
    }
  }
}

// Append new entries
const newLevels = [...existingLevels, ...curatedEntries];

// Rebuild file content
mkdirSync('src/data', { recursive: true });

const header = [
  '/**',
  ' * Curated Classic / Diagonal levels.',
  ' *',
  ' * These are candidate levels that have been reviewed in the GM Console',
  ' * and marked APPROVED, then written via `npm run apply:level-candidates -- --write`.',
  ' *',
  ' * Each entry is a complete snapshot of the candidate at review time,',
  ' * NOT a regeneration seed.  The grid is reconstructed deterministically',
  ' * from `path` + `hiddenIndices` so that the in-game experience exactly',
  ' * matches what was play-tested in the GM dev candidate panel.',
  ' *',
  ' * Curated levels are appended to the END of their respective mode/diff',
  ' * section and never inserted in the middle of existing generated levels.',
  ' *',
  ' * portal / portalCollect levels are NOT stored here — they live in',
  ' * `src/data/portalLevels.js`.',
  ' */',
  '',
  'import { _setCuratedCountFn } from \'../config/gameModes.js\';',
  '',
  'const CURATED_LEVELS = ',
  JSON.stringify(newLevels, null, 2),
  ';',
  '',
  '_setCuratedCountFn((mode, diff) =>',
  '  CURATED_LEVELS.filter(l => l.mode === mode && l.diff === diff).length',
  ');',
  '',
  '/** Look up a curated level by mode, diff, and per-diff level index. */',
  'export function getCuratedLevel(mode, diff, levelIdx) {',
  '  return CURATED_LEVELS.find(',
  '    l => l.mode === mode && l.diff === diff && l.levelIdx === levelIdx',
  '  ) || null;',
  '}',
  '',
  'export function buildCuratedGrid(curated) {',
  '  const N = curated.N;',
  '  const hiddenSet = new Set(curated.hiddenIndices || []);',
  '  const grid = [];',
  '  for (let i = 0; i < N * N; i++) {',
  '    const val = (curated.path.indexOf(i) + 1) || 0;',
  '    grid.push({ val, isHidden: hiddenSet.has(i), isRevealed: false, isExcluded: false, isHinted: false });',
  '  }',
  '  return {',
  '    config: {',
  '      N,',
  '      hiddenMin: curated.hiddenIndices ? curated.hiddenIndices.length : 0,',
  '      hiddenMax: curated.hiddenIndices ? curated.hiddenIndices.length : 0,',
  '      hp: N === 5 ? 3 : N === 7 ? 5 : 10,',
  '      coins: N === 5 ? 10 : N === 7 ? 20 : 40,',
  '      times: N === 5 ? [30, 60] : N === 7 ? [90, 180] : [300, 600],',
  '      maxGap: N === 5 ? 2 : N === 7 ? 3 : 4',
  '    },',
  '    grid,',
  '    startIndex: curated.path[0]',
  '  };',
  '}',
  '',
  'export function curatedLevelCount(mode, diff) {',
  '  return CURATED_LEVELS.filter(l => l.mode === mode && l.diff === diff).length;',
  '}',
  ''
];

writeFileSync(curatedPath, header.join('\n'));

console.log(`✅ 已写入 ${curatedEntries.length} 个 curated level 到 ${curatedPath}`);
for (let i = 0; i < curatedEntries.length; i++) {
  const e = curatedEntries[i];
  const lvlNum = currentTotal + i + 1;
  console.log(`   #${lvlNum} (idx ${currentTotal + i})  ${e.mode} ${e.diff}  seed=${e.source.seed}  sim=${e.similarityScore}  arch=${e.archetypeTag}`);
}
console.log('');

// ── Post-write validation ──
console.log('🔍 写入后校验...');
try {
  const raw = readFileSync(curatedPath, 'utf8');
  const written = parseCuratedLevels(raw);
  const newWrittenCount = written.filter(l => l.mode === targetMode && l.diff === targetDiff).length;

  console.log(`   curated 文件读取正常`);
  console.log(`   ${targetMode} ${targetDiff}: ${currentBase} generated + ${newWrittenCount} curated = ${currentBase + newWrittenCount} total`);
  console.log(`   目标上限: ${targetLimit}`);

  // Verify each entry
  for (const entry of curatedEntries) {
    const found = written.find(l =>
      l.mode === entry.mode && l.diff === entry.diff &&
      l.source?.candidateKey === entry.source.candidateKey
    );
    if (!found) {
      console.error(`   ❌ 写入后找不到: ${entry.source.candidateKey}`);
      process.exit(1);
    }
    if (JSON.stringify(found.path) !== JSON.stringify(entry.path)) {
      console.error(`   ❌ Path 不一致: ${entry.source.candidateKey}`);
      process.exit(1);
    }
    if (JSON.stringify(found.hiddenIndices) !== JSON.stringify(entry.hiddenIndices)) {
      console.error(`   ❌ hiddenIndices 不一致: ${entry.source.candidateKey}`);
      process.exit(1);
    }
  }
  console.log(`   ✅ 所有 candidate 写入后校验通过`);
} catch (e) {
  console.error(`   ❌ 写入后校验失败: ${e.message}`);
  process.exit(1);
}

console.log('');
console.log('✅ --write 完成。');
console.log(`   新增: ${curatedEntries.length} | ${targetMode} ${targetDiff}: ${currentTotal} → ${currentTotal + curatedEntries.length}/${targetLimit}`);
