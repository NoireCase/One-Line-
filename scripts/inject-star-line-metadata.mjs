/**
 * 为 starLineLevels.js 注入 gameId、techniqueTags，并修正 difficultyBand/teachingFocus。
 * 默认 dry-run；显式传 --write 才实际写入。元数据均为逐关显式映射。
 * 幂等：已是目标值时不修改。不触碰 solution、regions、quota。
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';

const DRY_RUN = !process.argv.includes('--write');
const LEVELS_PATH = new URL('../src/data/starLineLevels.js', import.meta.url).pathname;

// ── 逐关显式映射（Lv.1–30） ──
const METADATA = [
  // Lv.1: 星线入门 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','adjacency-exclusion'], difficultyBand: 'beginner', teachingFocus: '基础规则：每行每列每区各一星，星点八向不相邻' },
  // Lv.2: 星线晨光 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection'], difficultyBand: 'beginner', teachingFocus: '均衡区域中的行列排除法' },
  // Lv.3: 星线浅滩 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','adjacency-exclusion','region-row-lock'], difficultyBand: 'beginner', teachingFocus: '受限区域：区域形状约束星点候选位置' },
  // Lv.4: 星线微光 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-capacity'], difficultyBand: 'beginner', teachingFocus: '区域容量：小区域强制星点布局' },
  // Lv.5: 星线初探 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','edge-region','symmetry-break'], difficultyBand: 'beginner', teachingFocus: '边缘区域与对称性突破' },
  // Lv.6: 星线启程 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-column-lock','coupled-regions'], difficultyBand: 'beginner', teachingFocus: '耦合区域：两区互锁决定星点位置' },
  // Lv.7: 星线漫步 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection','short-contradiction'], difficultyBand: 'beginner', teachingFocus: '短链矛盾：尝试放置快速导出冲突' },
  // Lv.8: 星线曙光 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','propagation-chain','global-balance'], difficultyBand: 'beginner', teachingFocus: '传播链与全局平衡：多步推理' },
  // Lv.9: 星线试炼 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','adjacency-exclusion','irregular-region','region-capacity'], difficultyBand: 'beginner', teachingFocus: '不规则区域综合：容量+排除+邻接组合' },
  // Lv.10: 星线初成 (5×5 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection','region-row-lock','region-column-lock','coupled-regions'], difficultyBand: 'beginner', teachingFocus: '5×5 综合：入门阶段全技巧巩固' },
  // Lv.11: 星线展翼 (6×6 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection','edge-region'], difficultyBand: 'beginner', teachingFocus: '6×6 入门：更大盘面上的行列交叉排除' },
  // Lv.12: 星线探路 (6×6 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-capacity','irregular-region'], difficultyBand: 'beginner', teachingFocus: '6×6 进阶：不规则区域的容量限制推理' },
  // Lv.13: 星线飞渡 (6×6 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','propagation-chain','coupled-regions'], difficultyBand: 'beginner', teachingFocus: '6×6 进阶：大区域的跨行跨列推理' },
  // Lv.14: 星线入阵 (6×6 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-row-lock','region-column-lock','irregular-region'], difficultyBand: 'beginner', teachingFocus: '6×6 综合：不规则区域的系统排除' },
  // Lv.15: 星线挑战 (7×7 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection','propagation-chain','global-balance'], difficultyBand: 'beginner', teachingFocus: '7×7 检查点：从入门到进阶的桥梁' },
  // Lv.16: 星线破晓 (7×7 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-capacity','short-contradiction','irregular-region'], difficultyBand: 'intermediate', teachingFocus: '7×7 大区排除：利用矛盾链推进推理' },
  // Lv.17: 星线纵横 (8×8 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','coupled-regions','edge-region','symmetry-break'], difficultyBand: 'intermediate', teachingFocus: '8×8 一星：大区域耦合与边缘控制' },
  // Lv.18: 星线纵深 (9×9 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','propagation-chain','global-balance','short-contradiction'], difficultyBand: 'intermediate', teachingFocus: '9×9 一星：长链传播与全局平衡判断' },
  // Lv.19: 星线远航 (9×9 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','row-column-intersection','region-row-lock','region-column-lock','irregular-region'], difficultyBand: 'intermediate', teachingFocus: '9×9 一星：最大盘面综合扫描' },
  // Lv.20: 星线万象 (10×10 Q=1)
  { gameId: 'starSingle', techniqueTags: ['row-single','column-single','region-single','region-capacity','coupled-regions','symmetry-break','global-balance','irregular-region'], difficultyBand: 'intermediate', teachingFocus: '10×10 一星，最大盘面上的综合扫描技能' },
  // Lv.21: 双星初现 (8×8 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','quota-two-of-two','double-star-spacing','row-capacity','column-capacity'], difficultyBand: 'intermediate', teachingFocus: '8×8 双星：每行每列每区各2星，双星互斥规则' },
  // Lv.22: 双星探路 (8×8 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','quota-two-of-two','double-star-spacing','row-capacity','region-capacity'], difficultyBand: 'intermediate', teachingFocus: '8×8 双星：行列配额已达上限时排除候选格' },
  // Lv.23: 双星成阵 (8×8 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-two-of-two','double-star-spacing','row-pair','column-pair','region-capacity'], difficultyBand: 'intermediate', teachingFocus: '8×8 双星：完成行列配对与区域配额推理' },
  // Lv.24: 双星连珠 (9×9 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','quota-two-of-two','double-star-spacing','row-region-coupling','column-region-coupling'], difficultyBand: 'intermediate', teachingFocus: '9×9 双星：行列与区域的跨约束耦合推理' },
  // Lv.25: 双星闪耀 (9×9 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-two-of-two','double-star-spacing','region-pair','alternating-candidates','high-density-reduction'], difficultyBand: 'intermediate', teachingFocus: '9×9 双星：交替候选集与高密度区域化简' },
  // Lv.26: 双星争辉 (9×9 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','double-star-spacing','coupled-quota-chain','saturation-contradiction','row-capacity','column-capacity'], difficultyBand: 'intermediate', teachingFocus: '9×9 双星：耦合配额链与饱和矛盾法' },
  // Lv.27: 双星交错 (9×9 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-two-of-two','double-star-spacing','row-pair','column-pair','region-pair','global-combination'], difficultyBand: 'intermediate', teachingFocus: '9×9 双星：行列区域三线配对与全局组合' },
  // Lv.28: 双星凌云 (10×10 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','quota-two-of-two','double-star-spacing','row-region-coupling','column-region-coupling','saturation-contradiction'], difficultyBand: 'advanced', teachingFocus: '10×10 双星：大棋盘饱和推理与跨区联动' },
  // Lv.29: 双星巅峰 (10×10 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-two-of-two','double-star-spacing','alternating-candidates','coupled-quota-chain','high-density-reduction','global-combination'], difficultyBand: 'advanced', teachingFocus: '10×10 双星：极限密度下的交替候选与全局削减' },
  // Lv.30: 双星极境 (10×10 Q=2)
  { gameId: 'starDouble', techniqueTags: ['quota-zero-of-two','quota-one-of-two','quota-two-of-two','double-star-spacing','row-pair','column-pair','region-pair','row-region-coupling','column-region-coupling','saturation-contradiction','global-combination','high-density-reduction'], difficultyBand: 'advanced', teachingFocus: '10×10 双星：全技巧综合 · 小高峰挑战' },
];

// ── 读取文件 ──
let content = readFileSync(LEVELS_PATH, 'utf-8');
const lines = content.split('\n');

// ── 找到关卡对象起始行 ──
const levelStartPattern = /^\s*\{\s*\/\/\s*Lv\.\d+/;
const levelIndices = [];
for (let i = 0; i < lines.length; i++) {
  if (levelStartPattern.test(lines[i])) {
    levelIndices.push(i);
  }
}

if (levelIndices.length !== 30) {
  console.error(`Expected 30 level start lines, found ${levelIndices.length}`);
  process.exit(1);
}

// ── 逐关注入 gameId 和 techniqueTags ──
// 从最后一个关卡开始处理，避免行号偏移
for (let li = 29; li >= 0; li--) {
  const meta = METADATA[li];
  const startLine = levelIndices[li];

  // 找到该关卡对象的 teachingFocus 行
  let tfLine = -1;
  for (let j = startLine; j < Math.min(startLine + 30, lines.length); j++) {
    if (/^\s*teachingFocus:/.test(lines[j])) {
      tfLine = j;
      break;
    }
  }

  if (tfLine === -1) {
    console.error(`Level ${li + 1}: teachingFocus line not found`);
    process.exit(1);
  }

  // 获取 teachingFocus 行的缩进
  const indent = lines[tfLine].match(/^(\s*)/)[1];

  // 在 teachingFocus 之后插入 techniqueTags
  const tagsStr = JSON.stringify(meta.techniqueTags);
  lines.splice(tfLine + 1, 0, `${indent}techniqueTags: ${tagsStr},`);

  // 在 difficultyBand 行后插入 gameId（如果该行存在且还没有 gameId）
  let dbLine = -1;
  for (let j = startLine; j < Math.min(startLine + 30, lines.length); j++) {
    if (/^\s*difficultyBand:/.test(lines[j])) {
      dbLine = j;
      break;
    }
  }

  if (dbLine !== -1) {
    // 检查是否已有 gameId
    let hasGameId = false;
    for (let j = startLine; j < Math.min(startLine + 35, lines.length); j++) {
      if (/^\s*gameId:/.test(lines[j])) { hasGameId = true; break; }
    }
    if (!hasGameId) {
      lines.splice(dbLine + 1, 0, `${indent}gameId: '${meta.gameId}',`);
    }
  }

  // 更新 difficultyBand 和 teachingFocus（如果与当前值不同）
  for (let j = startLine; j < Math.min(startLine + 35, lines.length); j++) {
    if (/^\s*difficultyBand:/.test(lines[j])) {
      const current = lines[j].match(/'([^']*)'/)?.[1];
      if (current && current !== meta.difficultyBand) {
        lines[j] = lines[j].replace(/'[^']*'/, `'${meta.difficultyBand}'`);
      }
    }
    if (/^\s*teachingFocus:/.test(lines[j])) {
      const current = lines[j].match(/'([^']*)'/)?.[1];
      if (current && current !== meta.teachingFocus) {
        lines[j] = lines[j].replace(/'[^']*'/, `'${meta.teachingFocus}'`);
      }
    }
  }
}

// ── 更新文件头部注释 ──
const headerEnd = lines.findIndex(l => l.startsWith('export const'));
if (headerEnd > 0) {
  // 更新描述以反映元数据补充
  for (let i = 0; i < headerEnd; i++) {
    if (lines[i].includes('关卡数据 — Lv.1–30')) {
      lines[i] = ' * Star Line (星线谜阵) 关卡数据 — Lv.1–30（含 gameId 与 techniqueTags）';
    }
  }
}

if (DRY_RUN) {
  console.log('[dry-run] 将修改以下内容（使用 --write 实际写入）:');
  // Show what would change
  let changes = 0;
  const orig = readFileSync(LEVELS_PATH, 'utf-8').split('\n');
  for (let i = 0; i < Math.max(lines.length, orig.length); i++) {
    if (lines[i] !== orig[i]) { changes++; console.log(`  line ${i + 1}: ${(orig[i] || '').trim()} → ${(lines[i] || '').trim()}`); }
  }
  console.log(`[dry-run] ${changes} 行将被修改。使用 --write 实际写入。`);
} else {
  const orig = readFileSync(LEVELS_PATH, 'utf-8');
  const updated = lines.join('\n');
  if (orig === updated) { console.log('已是最新状态，无需修改。'); process.exit(0); }
  writeFileSync(LEVELS_PATH, updated, 'utf-8');
  console.log('Done: injected gameId, techniqueTags, and corrected difficultyBand/teachingFocus for all 30 levels.');
}
