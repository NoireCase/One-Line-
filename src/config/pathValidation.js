// pathValidation.js —— 集中式移动验证
// 所有移动必须通过此模块，与输入模式无关

/**
 * 4 向相邻判定
 */
function isAdjacent4(a, b, N) {
  const ar = Math.floor(a / N), ac = a % N;
  const br = Math.floor(b / N), bc = b % N;
  return (Math.abs(ar - br) + Math.abs(ac - bc)) === 1;
}

/**
 * 8 向相邻判定
 */
function isAdjacent8(a, b, N) {
  const ar = Math.floor(a / N), ac = a % N;
  const br = Math.floor(b / N), bc = b % N;
  const dr = Math.abs(ar - br);
  const dc = Math.abs(ac - bc);
  return dr <= 1 && dc <= 1 && (dr + dc > 0);
}

/**
 * 路径交叉检测
 */
function hasPathCrossing(path, current, target, N, rules) {
  if (rules.path?.allowCrossing) return false;
  if (path.length < 2) return false;

  const ar = Math.floor(current / N), ac = current % N;
  const br = Math.floor(target / N), bc = target % N;

  // 只有斜向移动才检测交叉
  if (ar === br || ac === bc) return false;

  const candidate1 = br * N + ac;
  const candidate2 = ar * N + bc;
  if (path.includes(candidate1) && path.includes(candidate2)) return true;

  return false;
}

/**
 * 统一移动验证
 * @param {number} current - 当前格索引
 * @param {number} target - 目标格索引
 * @param {number} N - 棋盘尺寸
 * @param {object} rules - 规则对象 { movement, path, bridge, portal }
 * @param {array} path - 当前路径数组
 * @returns {boolean}
 */
export function validateMove(current, target, N, rules, path = []) {
  if (current === target) return false;
  if (typeof current !== 'number' || typeof target !== 'number') return false;
  if (target < 0 || target >= N * N) return false;
  if (current < 0 || current >= N * N) return false;

  // 不能重复访问
  if (path.includes(target)) return false;

  // 相邻检查
  const isDiagonal = rules.movement === 'diagonal';
  const adjacent = isDiagonal
    ? isAdjacent8(current, target, N)
    : isAdjacent4(current, target, N);

  if (!adjacent) return false;

  // 路径交叉检查
  if (hasPathCrossing(path, current, target, N, rules)) return false;

  return true;
}


