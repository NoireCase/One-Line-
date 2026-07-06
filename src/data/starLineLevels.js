/**
 * Star Line (星线谜阵) 关卡数据。
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
export const STAR_LINE_LEVELS = [
  {
    id: 'star-easy-01',
    name: '星线入门',
    N: 5,
    difficulty: 'easy',
    regions: [
      0, 0, 1, 1, 1,
      2, 2, 1, 1, 1,
      2, 2, 1, 1, 1,
      2, 2, 3, 4, 4,
      2, 2, 4, 4, 4,
    ],
    solution: [1, 8, 10, 17, 24],
    revealPath: [1, 8, 10, 17, 24],
  },
  {
    id: 'star-easy-02',
    name: '星线初探',
    N: 5,
    difficulty: 'easy',
    regions: [
      2, 2, 0, 0, 0,
      2, 2, 1, 1, 0,
      2, 2, 4, 1, 3,
      2, 2, 4, 3, 3,
      4, 4, 4, 4, 4,
    ],
    solution: [4, 7, 10, 18, 21],
    revealPath: [4, 7, 10, 18, 21],
  },
  {
    id: 'star-medium-01',
    name: '星线进阶 I',
    N: 6,
    difficulty: 'medium',
    regions: [
      1, 0, 0, 0, 2, 4,
      1, 3, 2, 2, 2, 4,
      3, 3, 2, 2, 2, 4,
      3, 3, 5, 2, 2, 4,
      5, 5, 5, 4, 4, 4,
      5, 5, 5, 4, 4, 4,
    ],
    solution: [3, 6, 16, 19, 29, 32],
    revealPath: [3, 6, 16, 19, 29, 32],
  },
  {
    id: 'star-medium-02',
    name: '星线进阶 II',
    N: 6,
    difficulty: 'medium',
    regions: [
      2, 0, 0, 0, 0, 1,
      2, 3, 3, 3, 3, 1,
      2, 3, 3, 3, 4, 4,
      5, 3, 3, 4, 4, 4,
      5, 5, 3, 3, 4, 4,
      5, 5, 5, 5, 4, 4,
    ],
    solution: [3, 11, 12, 20, 28, 31],
    revealPath: [3, 11, 12, 20, 28, 31],
  },
  {
    id: 'star-hard-01',
    name: '星线挑战',
    N: 7,
    difficulty: 'hard',
    regions: [
      1, 0, 0, 0, 0, 0, 0,
      1, 1, 1, 0, 0, 2, 2,
      1, 1, 0, 0, 0, 2, 2,
      3, 1, 0, 0, 2, 2, 2,
      3, 1, 4, 0, 4, 4, 2,
      3, 6, 4, 4, 4, 5, 5,
      6, 6, 6, 4, 4, 5, 5,
    ],
    solution: [3, 8, 19, 21, 32, 41, 44],
    revealPath: [3, 8, 19, 21, 32, 41, 44],
  },
];
