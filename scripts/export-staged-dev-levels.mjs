/**
 * Dev-only: 读取 staged-level-candidates.json → 生成 src/config/devLevelCandidates.generated.js
 * 用法：
 *   npm run export:dev-level-candidates                      # 覆盖导出
 *   npm run export:dev-level-candidates -- --append true     # 合并导出
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// ── CLI ──
const args = process.argv.slice(2);
function opt(k, def) { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; }
const doAppend = opt('--append', 'false') === 'true';

const stagedPath = 'reports/staged-level-candidates.json';
if (!existsSync(stagedPath)) {
  console.error('staged-level-candidates.json 不存在。请先运行 npm run generate:level-candidates -- --stage true');
  process.exit(1);
}

const staged = JSON.parse(readFileSync(stagedPath, 'utf8'));
const newCandidates = staged.candidates || [];

// ── candidate key ──
const candidateKey = (c) => `${c.mode}:${c.diff}:${c.seed}:${c.virtualIdx}`;

let merged = [];

if (doAppend) {
  const generatedPath = 'src/config/devLevelCandidates.generated.js';
  let existing = [];

  if (existsSync(generatedPath)) {
    try {
      const raw = readFileSync(generatedPath, 'utf8');
      // Extract the JSON array from the JS module
      const match = raw.match(/export const DEV_LEVEL_CANDIDATES\s*=\s*(\[[\s\S]*\])\s*;/);
      if (match) {
        existing = JSON.parse(match[1]);
      }
    } catch (e) {
      console.warn('⚠️  无法解析已有 generated 文件，将视为空列表:', e.message);
    }
  }

  // Build map from existing candidates
  const map = new Map();
  for (const c of existing) {
    map.set(candidateKey(c), c);
  }

  // Merge: same key → update, new key → append
  let updated = 0, added = 0;
  for (const c of newCandidates) {
    const key = candidateKey(c);
    if (map.has(key)) {
      map.set(key, c); // update with latest
      updated++;
    } else {
      map.set(key, c);
      added++;
    }
  }

  merged = Array.from(map.values());

  console.log(`📋 合并结果: 已有 ${existing.length} → 更新 ${updated} + 新增 ${added} = 共 ${merged.length} 个候选`);
} else {
  merged = newCandidates;
}

// ── Build mode × diff breakdown ──
const groups = new Map();
for (const c of merged) {
  const g = `${c.mode} ${c.diff}`;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(c);
}
const groupSummary = Array.from(groups.entries())
  .map(([g, list]) => `//   ${g}: ${list.length}`)
  .join('\n');

const lines = [];
lines.push('// GENERATED FILE — dev-only — do not edit manually');
lines.push('// do not use as official level data');
lines.push(`// generatedAt: ${new Date().toISOString()}`);
lines.push(`// total: ${merged.length} candidates`);
lines.push(groupSummary);
lines.push('');
lines.push('export const DEV_LEVEL_CANDIDATES = ');
lines.push(JSON.stringify(merged, null, 2));
lines.push(';');
lines.push('');

mkdirSync('src/config', { recursive: true });
writeFileSync('src/config/devLevelCandidates.generated.js', lines.join('\n'));

const mode = doAppend ? '合并' : '覆盖';
console.log(`✅ 已${mode}导出 ${merged.length} 个候选到 src/config/devLevelCandidates.generated.js`);
