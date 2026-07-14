/**
 * Star Line 候选 I/O 安全工具。
 * 生成器和分析器共享同一份路径规则和原子写入逻辑。
 */
import { resolve, relative, normalize } from 'path';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, renameSync } from 'fs';
import { randomBytes } from 'crypto';

/** 唯一允许的候选输出根目录（相对于仓库根目录） */
export const CANDIDATE_ROOT = 'tmp/star-line-candidates';

/** 正式源码目录——禁止写入 */
const PROTECTED_DIRS = ['src', 'scripts', 'e2e', 'docs', 'public', 'dist', 'node_modules', '.git'];
const PROTECTED_FILES = ['package.json', 'package-lock.json'];

/**
 * 解析候选输出路径。
 * 用户提供的 --output 只能是 CANDIDATE_ROOT 下的文件名或相对路径。
 * 返回规范化绝对路径，如不安全则抛出错误。
 */
export function resolveCandidatePath(rawOutput) {
  if (!rawOutput || typeof rawOutput !== 'string') {
    throw new Error('--output 不能为空');
  }

  const cwd = process.cwd();

  // 拒绝绝对路径（防止绕过根目录限制）
  if (rawOutput.startsWith('/')) {
    throw new Error(`--output 不支持绝对路径: ${rawOutput}。请使用相对于 ${CANDIDATE_ROOT}/ 的路径。`);
  }

  // 规范化并解析
  const normalized = normalize(rawOutput);

  // 拒绝 ../ 逃逸
  if (normalized.startsWith('..') || normalized.includes('../')) {
    throw new Error(`--output 不允许使用 ../ 逃逸: ${rawOutput}`);
  }

  // 拒绝符号链接逃逸——通过检查规范化后的路径仍在允许根内
  const fullPath = resolve(cwd, CANDIDATE_ROOT, normalized);

  // 再次确认解析后路径在 CANDIDATE_ROOT 内
  const rootPath = resolve(cwd, CANDIDATE_ROOT);
  const rel = relative(rootPath, fullPath);
  if (rel.startsWith('..') || resolve(rootPath, rel) !== fullPath) {
    throw new Error(`--output 路径必须在 ${CANDIDATE_ROOT}/ 内: ${rawOutput} → ${fullPath}`);
  }

  // 确认最终路径不在受保护目录中
  for (const dir of PROTECTED_DIRS) {
    if (fullPath.includes(`/${dir}/`) || fullPath.startsWith(resolve(cwd, dir))) {
      throw new Error(`--output 不能指向源码目录: ${rawOutput} → ${fullPath}`);
    }
  }
  for (const f of PROTECTED_FILES) {
    if (fullPath.endsWith(`/${f}`) || fullPath === resolve(cwd, f)) {
      throw new Error(`--output 不能指向受保护文件: ${rawOutput} → ${fullPath}`);
    }
  }

  // 确认不在仓库根目录直接写文件
  const repoRel = relative(cwd, fullPath);
  if (!repoRel.startsWith(CANDIDATE_ROOT)) {
    throw new Error(`--output 必须位于 ${CANDIDATE_ROOT}/ 下: ${rawOutput}`);
  }

  return fullPath;
}

/**
 * 安全原子写入。
 * 1. 写入临时文件
 * 2. 成功后 rename 到目标路径
 * 3. 失败时清理临时文件
 */
export function safeWriteJSON(outputPath, data, { force = false } = {}) {
  const dir = resolve(outputPath, '..');
  mkdirSync(dir, { recursive: true });

  if (existsSync(outputPath) && !force) {
    throw new Error(`输出文件已存在: ${outputPath}。使用 --force 覆盖。`);
  }

  if (existsSync(outputPath) && force) {
    // 确认 force 只在候选目录内有效
    const rootPath = resolve(process.cwd(), CANDIDATE_ROOT);
    if (!outputPath.startsWith(rootPath)) {
      throw new Error(`--force 只能在 ${CANDIDATE_ROOT}/ 内使用`);
    }
  }

  const tmpPath = `${outputPath}.tmp-${randomBytes(4).toString('hex')}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    renameSync(tmpPath, outputPath);
  } catch (e) {
    try { unlinkSync(tmpPath); } catch {}
    throw e;
  }
}

/**
 * 写入分析报告（JSON 和 Markdown）。
 */
export function safeWriteAnalysis(outputBase, jsonData, mdText, { force = false } = {}) {
  safeWriteJSON(`${outputBase}.json`, jsonData, { force });
  const tmpMd = `${outputBase}.md.tmp-${randomBytes(4).toString('hex')}`;
  try {
    writeFileSync(tmpMd, mdText, 'utf-8');
    if (existsSync(`${outputBase}.md`) && !force) {
      unlinkSync(tmpMd);
      throw new Error(`报告文件已存在: ${outputBase}.md。使用 --force 覆盖。`);
    }
    renameSync(tmpMd, `${outputBase}.md`);
  } catch (e) {
    try { unlinkSync(tmpMd); } catch {}
    throw e;
  }
}
