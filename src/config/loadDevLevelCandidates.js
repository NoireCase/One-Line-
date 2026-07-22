/**
 * 安全加载本地 dev 候选关卡（generated 文件可能不存在）。
 *
 * 在干净 checkout / CI 中 generated 文件不存在时必须安全回退为空数组，
 * 不能导致 Vite transform 失败或 web server 崩溃。
 */

const generatedModules = import.meta.glob('./devLevelCandidates.generated.js');
const e2eModules = import.meta.glob('./devLevelCandidates.e2e.js');

async function loadCandidateList(loader, exportName) {
  if (!loader) return [];
  try {
    const mod = await loader();
    return Array.isArray(mod[exportName]) ? mod[exportName] : [];
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<Array>} 候选关卡数组；文件不存在时返回空数组
 */
export async function loadDevLevelCandidates() {
  if (import.meta.env.VITE_E2E_DEV_CANDIDATES === '1') {
    return loadCandidateList(
      e2eModules['./devLevelCandidates.e2e.js'],
      'E2E_DEV_LEVEL_CANDIDATES'
    );
  }

  return loadCandidateList(
    generatedModules['./devLevelCandidates.generated.js'],
    'DEV_LEVEL_CANDIDATES'
  );
}
