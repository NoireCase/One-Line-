/**
 * 静态门禁：禁止源码直接字面量导入 gitignored generated 文件。
 *
 * Vite 会在 pre-transform 阶段硬解析字面量动态 import，
 * 被 .gitignore 忽略的 generated 文件在干净 checkout 中不存在
 * 会导致 web server 崩溃。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join((() => {
  const p = fileURLToPath(import.meta.url);
  return join(p, '..', '..');
})(), '');

// .gitignore 中列为 generated 的文件名
const GENERATED_FILES = [
  'devLevelCandidates.generated.js',
];

// 唯一允许引用 generated 文件的 loader
const LOADER_PATH = 'src/config/loadDevLevelCandidates.js';

let failed = false;

function fail(msg) {
  console.error(`❌ ${msg}`);
  failed = true;
}

// 1. loader 模块必须存在且使用 import.meta.glob
const loaderAbs = join(ROOT, LOADER_PATH);
if (!existsSync(loaderAbs)) {
  fail(`loader "${LOADER_PATH}" 不存在`);
} else {
  const loaderSrc = readFileSync(loaderAbs, 'utf-8');
  if (!loaderSrc.includes('import.meta.glob')) {
    fail(`loader "${LOADER_PATH}" 未使用 import.meta.glob`);
  }
}

// 2. 遍历 src/ 下所有 JS/JSX 文件，除 loader 外不得引用 generated 文件名
function walkSync(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        results.push(...walkSync(full));
      } else if (st.isFile() && (entry.endsWith('.js') || entry.endsWith('.jsx') || entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
        results.push(full);
      }
    }
  } catch { /* 跳过不可读目录 */ }
  return results;
}

const srcFiles = walkSync(join(ROOT, 'src'));

for (const absPath of srcFiles) {
  const relPath = absPath.slice(ROOT.length + 1);
  if (relPath === LOADER_PATH) continue;

  const content = readFileSync(absPath, 'utf-8');
  for (const gf of GENERATED_FILES) {
    if (content.includes(gf)) {
      fail(`"${relPath}" 直接引用 generated 文件 "${gf}" — 应通过 "src/config/loadDevLevelCandidates.js" 导入`);
    }
  }
}

if (failed) {
  console.error('\n⛔ generated 文件安全门禁未通过');
  process.exit(1);
}

console.log('✅ generated 文件安全门禁通过');
