/**
 * Apply dry-run checker — 入库前校验脚本
 *
 * 当前阶段：仅支持 dry-run 校验，不支持正式写入。
 * --write 传入时会明确失败。
 *
 * Usage:
 *   npm run apply:level-candidates -- --mode classic --diff medium --keys classic:medium:109:109 --dry-run
 *
 * Safety:
 *   - Default dry-run (never modifies files without explicit --write in a future version)
 *   - Enforces TARGET_STRUCTURE limits (10/20/30 per difficulty)
 *   - Validates all candidates before reporting
 *   - Checks similarity scores against production levels
 */

import { readFileSync, existsSync } from 'fs';
import { CLASSIC_STRUCTURE, getTargetSectionCount } from '../src/config/gameModes.js';

// ── CLI ──
const args = process.argv.slice(2);
function opt(k, def) { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; }

const targetMode = opt('--mode', 'classic');
const targetDiff = opt('--diff', 'medium');
const keysStr = opt('--keys', '');
const sourcePath = opt('--source', 'src/config/devLevelCandidates.generated.js');
const doWrite = args.includes('--write');

// Current phase: dry-run only. --write is not yet supported.
if (doWrite) {
  console.error('❌ 当前版本仅支持 dry-run，不支持正式写入。');
  console.error('   正式写入将在下一阶段实现。');
  console.error('   请使用 --dry-run 进行入库前校验。');
  process.exit(1);
}

if (!['classic', 'diagonal'].includes(targetMode)) {
  console.error(`Invalid mode: ${targetMode}. Must be classic or diagonal.`);
  process.exit(1);
}
if (!['easy', 'medium', 'hard'].includes(targetDiff)) {
  console.error(`Invalid diff: ${targetDiff}. Must be easy, medium, or hard.`);
  process.exit(1);
}
if (!keysStr) {
  console.error('--keys is required. Format: mode:diff:seed:virtualIdx,mode:diff:seed:virtualIdx');
  process.exit(1);
}

const candidateKeys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
if (candidateKeys.length === 0) {
  console.error('No valid keys provided.');
  process.exit(1);
}

// ── Load source ──
if (!existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourcePath}`);
  console.error('Run: npm run export:dev-level-candidates');
  process.exit(1);
}

let sourceCandidates = [];
try {
  const raw = readFileSync(sourcePath, 'utf8');
  const match = raw.match(/export const DEV_LEVEL_CANDIDATES\s*=\s*(\[[\s\S]*\])\s*;/);
  if (match) sourceCandidates = JSON.parse(match[1]);
} catch (e) {
  console.error(`Failed to parse source file: ${e.message}`);
  process.exit(1);
}

// ── Resolve candidates ──
function candidateKey(c) { return `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx}`; }

const keyMap = new Map();
for (const c of sourceCandidates) keyMap.set(candidateKey(c), c);

const selected = [];
const missing = [];
for (const k of candidateKeys) {
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

  // Mode/diff match
  if (c.mode !== targetMode) errs.push(`mode mismatch: expected ${targetMode}, got ${c.mode}`);
  if (c.diff !== targetDiff) errs.push(`diff mismatch: expected ${targetDiff}, got ${c.diff}`);

  // Required fields
  if (!c.grid || c.grid.length === 0) errs.push('missing grid');
  if (!c.path || c.path.length === 0) errs.push('missing path');
  if (c.hiddenIndices === undefined) errs.push('missing hiddenIndices');
  if (c.qualityScore === undefined) errs.push('missing qualityScore');
  if (c.difficultyScore === undefined) errs.push('missing difficultyScore');

  // Quality thresholds
  if (c.qualityScore < 55) errs.push(`qualityScore too low: ${c.qualityScore} < 55`);

  // Grid validation
  if (c.grid) {
    const N = c.N;
    if (c.grid.length !== N * N) errs.push(`grid size mismatch: ${c.grid.length} !== ${N * N}`);
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
const currentCount = currentSection ? currentSection.count : 0;
const remaining = targetLimit - currentCount;

console.log(`\n═══════════════════════════════════════`);
console.log(`Apply Candidates: ${targetMode} / ${targetDiff}`);
console.log(`═══════════════════════════════════════`);
console.log(`  当前正式数量: ${currentCount}`);
console.log(`  目标上限:     ${targetLimit}`);
console.log(`  可追加数量:   ${remaining}`);
console.log(`  申请追加:     ${validated.length}`);
console.log('');

if (validated.length > remaining) {
  console.error(`❌ 超出容量: 需要 ${validated.length} 个位置，但只剩 ${remaining} 个。`);
  console.error(`   当前 ${targetMode} ${targetDiff} 已达到 ${currentCount}/${targetLimit}。`);
  process.exit(1);
}

// ── Future level numbers ──
const startLvl = currentCount; // 0-based level index for append
console.log('未来正式关卡编号:');
for (let i = 0; i < validated.length; i++) {
  const c = validated[i];
  const futureIdx = startLvl + i;
  const futureDisplay = futureIdx + 1;
  console.log(`  #${futureDisplay} (idx ${futureIdx})  seed=${c.seed}  Q=${c.qualityScore}  D=${c.difficultyScore}  sim=${c.similarityScore ?? '?'}  arch=${c.archetypeTag || '?'}`);
}
console.log('');

// ── Source file impact ──
// The actual level data is in src/config/levelConfig.js or generated by createClassicLevel
// For curated levels, we need to store them somewhere. Current approach:
// If the project has curated level storage, add there. Otherwise, generate from seed.
console.log('将影响的文件:');
console.log('  (curated level storage — implementation TBD)');
console.log('  关卡数据将追加到对应 mode/diff 末尾');
console.log('');

// ── Similarity check ──
const highSimCandidates = validated.filter(c => (c.maxSimilarity || c.similarityScore || 0) >= 98);
const warnSimCandidates = validated.filter(c => {
  const s = c.maxSimilarity || c.similarityScore || 0;
  return s >= 95 && s < 98;
});

if (highSimCandidates.length > 0) {
  console.error(`\n❌ HIGH SIMILARITY: ${highSimCandidates.length} 个候选 similarity >= 98，拒绝通过。`);
  for (const c of highSimCandidates) {
    const s = c.maxSimilarity || c.similarityScore || 0;
    const st = c.similarTo;
    console.error(`   seed=${c.seed}  sim=${s}  similarTo=${st?.candidateKey || st?.seed || 'unknown'} (${st?.source || '?'})`);
  }
  console.error('   后续将支持 --allow-similar 标志。当前阶段请先人工复核这些候选。');
  process.exit(1);
}

if (warnSimCandidates.length > 0) {
  console.log(`\n⚠️  HIGH SIMILARITY WARNING: ${warnSimCandidates.length} 个候选 similarity >= 95:`);
  for (const c of warnSimCandidates) {
    const s = c.maxSimilarity || c.similarityScore || 0;
    const st = c.similarTo;
    console.log(`   seed=${c.seed}  sim=${s}  similarTo=${st?.candidateKey || st?.seed || 'unknown'} (${st?.source || '?'})`);
  }
  console.log('');
}

// ── Dry-run output ──
console.log('🔍 DRY-RUN — 未修改任何文件。');
console.log('   当前版本仅支持 dry-run，不支持正式写入。');
console.log('');

// ── Summary ──
let exitCode = 0;
if (remaining <= 0) {
  console.error(`❌ ${targetMode} ${targetDiff} 已达目标上限 ${targetLimit}，无可用容量。`);
  exitCode = 1;
} else if (validated.length === 0) {
  console.error('❌ 没有通过校验的候选。');
  exitCode = 1;
} else {
  console.log(`✅ 校验通过: ${validated.length}/${selected.length} 个候选`);
  console.log(`   目标上限: ${targetLimit} | 当前: ${currentCount} | 可追加: ${remaining}`);
  if (warnSimCandidates.length > 0) {
    console.log(`   ⚠️  ${warnSimCandidates.length} 个候选 similarity >= 95，需人工复核。`);
  }
}

process.exit(exitCode);
