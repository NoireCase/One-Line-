/**
 * Star Line (星线番外) 关卡数据。
 *
 * 数据结构：
 * {
 *   id, name, N,
 *   regions: 扁平数组 regions[idx] = regionId (0..N-1),
 *   solution: 星点索引数组 (长度 N),
 *   revealPath: 结算展示顺序 (solution 的有序排列),
 *   difficulty: 'easy' | 'medium' | 'hard'
 * }
 */
export const STAR_LINE_LEVELS = [];
