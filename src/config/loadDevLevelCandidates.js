/**
 * 安全加载本地 dev 候选关卡（generated 文件可能不存在）。
 *
 * 在干净 checkout / CI 中 generated 文件不存在时必须安全回退为空数组，
 * 不能导致 Vite transform 失败或 web server 崩溃。
 */

const modules = import.meta.glob('./devLevelCandidates.generated.js');

/**
 * @returns {Promise<Array>} 候选关卡数组；文件不存在时返回空数组
 */
export async function loadDevLevelCandidates() {
  const key = './devLevelCandidates.generated.js';
  const loader = modules[key];
  if (!loader) {
    return [];
  }
  try {
    const mod = await loader();
    return Array.isArray(mod.DEV_LEVEL_CANDIDATES) ? mod.DEV_LEVEL_CANDIDATES : [];
  } catch {
    return [];
  }
}
