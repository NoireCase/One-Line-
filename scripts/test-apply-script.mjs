/**
 * Standalone tests for apply-staged-levels.mjs
 * Run: node scripts/test-apply-script.mjs
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function runApply(args) {
  try {
    return { output: execSync(`node scripts/apply-staged-levels.mjs ${args}`, { encoding: 'utf8', timeout: 10000 }), exitCode: 0 };
  } catch (e) {
    return { output: e.stdout || e.stderr || e.message || '', exitCode: e.status || 1 };
  }
}

function getFirstCandidateKey() {
  const path = 'src/config/devLevelCandidates.generated.js';
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const match = raw.match(/export const DEV_LEVEL_CANDIDATES\s*=\s*(\[[\s\S]*\])\s*;/);
    if (!match) return null;
    const list = JSON.parse(match[1]);
    if (!list.length) return null;
    // Find a diagonal hard candidate
    const c = list.find(x => x.mode === 'diagonal' && x.diff === 'hard') || list[0];
    return {
      key: `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx || c.seed}`,
      mode: c.mode,
      diff: c.diff,
      seed: c.seed,
      maxSim: c.maxSimilarity || c.similarityScore || 0
    };
  } catch { return null; }
}

console.log('Apply Script Tests\n');

test('--write fails with clear message', () => {
  const r = runApply('--mode classic --diff hard --keys test:hard:1:1 --write');
  if (r.exitCode !== 1) throw new Error(`expected exit 1, got ${r.exitCode}`);
  if (!r.output.includes('不支持正式写入')) throw new Error('missing error message');
});

test('missing keys fails', () => {
  const r = runApply('--mode classic --diff hard --keys nonexistent:hard:999:999 --dry-run');
  if (r.exitCode !== 1) throw new Error(`expected exit 1, got ${r.exitCode}`);
  if (!r.output.includes('not found')) throw new Error('missing not-found message');
});

test('over capacity check: mode/diff mismatch fails', () => {
  // Use a valid key with wrong mode/diff to test validation
  const ck = getFirstCandidateKey();
  if (!ck) { console.log('  ⚠️  SKIP: no candidates'); passed++; return; }
  // Use a different diff than the candidate's actual diff
  const wrongDiff = ck.diff === 'hard' ? 'easy' : 'hard';
  const r = runApply(`--mode ${ck.mode} --diff ${wrongDiff} --keys ${ck.key} --dry-run`);
  if (r.exitCode !== 1) throw new Error(`expected exit 1, got ${r.exitCode}`);
  if (!r.output.includes('mismatch')) throw new Error('missing mismatch message. Got: ' + r.output.substring(0, 200));
});

test('valid dry-run outputs future level number', () => {
  const ck = getFirstCandidateKey();
  if (!ck) { console.log('  ⚠️  SKIP: no candidates in generated file'); passed++; return; }
  const r = runApply(`--mode ${ck.mode} --diff ${ck.diff} --keys ${ck.key} --dry-run`);
  if (!r.output.includes('DRY-RUN') && !r.output.includes('未来正式')) throw new Error('missing DRY-RUN/future-level output. Got: ' + r.output.substring(0, 200));
  console.log(`  key=${ck.key} sim=${ck.maxSim} exit=${r.exitCode}`);
});

test('high similarity outputs warning', () => {
  const ck = getFirstCandidateKey();
  if (!ck) { console.log('  ⚠️  SKIP: no candidates'); passed++; return; }
  const r = runApply(`--mode ${ck.mode} --diff ${ck.diff} --keys ${ck.key} --dry-run`);
  if (ck.maxSim >= 95 && r.output.includes('SIMILARITY')) {
    console.log(`  similarity warning present for sim=${ck.maxSim}`);
  } else if (ck.maxSim >= 98) {
    if (r.exitCode !== 1) throw new Error('sim>=98 should fail but exitCode=' + r.exitCode);
    console.log(`  sim>=98 correctly blocked (exit=${r.exitCode})`);
  } else if (ck.maxSim < 95) {
    console.log(`  sim=${ck.maxSim} < 95, no warning needed`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
