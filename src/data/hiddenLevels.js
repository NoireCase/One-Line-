/**
 * Hidden / 极简线索 关卡数据（MVP demo，5×5，10 个手工关卡）
 *
 * 每关包含：
 *   id             — 稳定关卡标识
 *   title          — 玩家可见关卡名
 *   N              — 棋盘尺寸
 *   path           — 完整唯一路径（25 个索引，覆盖 0..24）
 *   keyNumbers     — 可见关键数字（必须包含 1 和 25）
 *   startIndex     — 路径起点（= path[0]）
 *   description    — 设计说明（仅 dev 参考）
 *   difficultyLabel — 难度标签
 *
 * 路径必须是四向连续（上下左右），不能重复，必须覆盖全盘。
 * 关键数字 a 到下一关键数字 b 之间，移动次数必须恰好 = b - a。
 *
 * 关卡顺序按难度递进排列：
 *   #1 入门引导 → #2 轻度推理 → #3 标准入门 → #4 标准偏难 → #5 标准推理 → #6 挑战
 */

const HIDDEN_LEVELS = [
  {
    id: 'hidden-demo-01',
    title: '第一步推理',
    N: 5,
    path: [0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24],
    keyNumbers: [1,5,11,17,22,25],
    startIndex: 0,
    description: '引导关：蛇形扫描路径，6 个关键数字分散在棋盘各区域。段长短交错（4/6/6/5/3），空间约束明确。',
    difficultyLabel: '引导'
  },
  {
    id: 'hidden-demo-04',
    title: '别有洞天',
    N: 5,
    path: [16,15,20,21,22,17,12,11,10,5,0,1,6,7,2,3,4,9,8,13,14,19,18,23,24],
    keyNumbers: [1,6,12,16,25],
    startIndex: 16,
    description: '轻度推理关：起点在左下区域。第一段 1→6 仅隔一格却要走 5 步（需绕行），最后一段 16→25 长距离扫描（9 步）。路径不规则，无蛇形/螺旋。',
    difficultyLabel: '轻度推理'
  },
  {
    id: 'hidden-demo-02',
    title: '岔路取舍',
    N: 5,
    path: [0,5,10,15,20,21,16,11,6,1,2,7,12,17,22,23,18,13,8,3,4,9,14,19,24],
    keyNumbers: [1,6,12,18,23,25],
    startIndex: 0,
    description: '标准入门关：列扫描 + 折返路径，6 个关键数字。段 3（12→18，曼哈顿 2 但需走 6 步）和段 4（18→23，曼哈顿 1 但需走 5 步）引入绕行推理。',
    difficultyLabel: '标准入门'
  },
  {
    id: 'hidden-demo-03',
    title: '全局推演',
    N: 5,
    path: [12,7,2,1,0,5,10,15,20,21,22,23,24,19,14,9,4,3,8,13,18,17,16,11,6],
    keyNumbers: [1,6,12,19,25],
    startIndex: 12,
    description: '标准偏难关：棋盘中心起点，螺旋式扫描路径。起点不在角落增加推理难度，段长 5/6/7/6 需要全局前瞻。5 个关键数字（比前几关少）。',
    difficultyLabel: '标准偏难'
  },
  {
    id: 'hidden-demo-05',
    title: '歧路抉择',
    N: 5,
    path: [12,11,10,5,0,1,6,7,2,3,4,9,8,13,14,19,24,23,18,17,22,21,16,15,20],
    keyNumbers: [1,8,13,21,25],
    startIndex: 12,
    description: '标准推理关：起点在棋盘正中央。前两段 1→8 和 8→13 都是相邻格但分别需要 7 步和 5 步——必须大幅绕行。13→21 是 8 步长段。路径不规则，无法靠形状识别通关。',
    difficultyLabel: '标准推理'
  },
  {
    id: 'hidden-demo-06',
    title: '终点迷局',
    N: 5,
    path: [12,7,2,3,4,9,8,13,14,19,24,23,18,17,22,21,20,15,16,11,10,5,6,1,0],
    keyNumbers: [1,6,14,19,25],
    startIndex: 12,
    description: '挑战关：中心起点，终点在左上角。段长 5/8/5/6，14→19 曼哈顿距离仅 1 格却需走 5 步。全局前瞻要求高：错误绕行会封死后续路径。',
    difficultyLabel: '挑战'
  },
  {
    id: 'hidden-demo-07',
    title: '边缘切入',
    N: 5,
    path: [2,3,4,9,8,7,12,13,14,19,24,23,18,17,22,21,20,15,16,11,10,5,6,1,0],
    keyNumbers: [1,6,14,18,25],
    startIndex: 2,
    description: '起点在顶部边缘。双 close pair：1→6（曼哈顿2但需5步）和 6→14（曼哈顿1但需8步长段）。路径不规则，无法靠形状识别。',
    difficultyLabel: '标准推理'
  },
  {
    id: 'hidden-demo-08',
    title: '长段穿行',
    N: 5,
    path: [6,1,0,5,10,11,12,7,2,3,4,9,8,13,14,19,24,23,18,17,22,21,16,15,20],
    keyNumbers: [1,4,9,20,25],
    startIndex: 6,
    description: '起点在棋盘内部(1,1)。9→20是11步超长段（extra=8），是当前所有关卡中最长单段。全关无close pair，完全靠空间约束和长段推理。',
    difficultyLabel: '标准推理'
  },
  {
    id: 'hidden-demo-09',
    title: '右翼穿梭',
    N: 5,
    path: [14,19,24,23,18,13,12,17,22,21,20,15,16,11,10,5,0,1,6,7,2,3,4,9,8],
    keyNumbers: [1,5,8,18,25],
    startIndex: 14,
    description: '起点在右侧边缘。5→8→18 包含10步超长段（extra=6），是当前所有关卡中最长的单段。路径在棋盘左右区域穿梭。',
    difficultyLabel: '标准偏难'
  },
  {
    id: 'hidden-demo-10',
    title: '全局扣合',
    N: 5,
    path: [8,3,4,9,14,13,12,7,2,1,0,5,6,11,10,15,20,21,16,17,22,23,24,19,18],
    keyNumbers: [1,7,13,19,25],
    startIndex: 8,
    description: '起点在棋盘内部(1,3)。四段全部为close pair（extra≥4），13→19是8步长段。全关需要连续处理近距离高绕行段，四段等长节奏统一，适合作为easy段收官。',
    difficultyLabel: '标准推理'
  },

  // ═══════════════════════════════════════
  // Medium 阶段：7×7 首批 10 关 (#11–#20)
  // ═══════════════════════════════════════

  {
    id: 'hidden-medium-11',
    title: '双区迷局',
    N: 7,
    path: [10,3,2,1,0,7,14,21,28,35,42,43,36,29,22,15,8,9,16,17,18,11,4,5,6,13,12,19,20,27,34,41,48,47,40,33,26,25,32,39,46,45,44,37,38,31,24,23,30],
    keyNumbers: [1,2,9,14,18,22,29,30,37,44,49],
    startIndex: 10,
    description: 'AREA_SPLIT：11 个关键数字，10 段，平均段长 4.8。棋盘自然分为左右两区。22→29（extra=4 close pair）和 30→37（extra=6 close pair）是两处核心绕行段，玩家必须先左后右，在中线通道处精确控制步数。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT']
  },
  {
    id: 'hidden-medium-12',
    title: '四角困局',
    N: 7,
    path: [22,21,28,29,36,35,42,43,44,37,30,23,24,31,38,45,46,47,48,41,40,39,32,25,26,33,34,27,20,13,6,5,12,19,18,17,16,15,14,7,0,1,8,9,2,3,4,11,10],
    keyNumbers: [1,2,9,16,17,22,23,30,33,34,35,38,43,46,49],
    startIndex: 22,
    description: 'CORNER_LOCK：15 个关键数字，14 段。9→16（extra=6 close pair）和 22→23（锚点短段）+ 38→43（extra=4 close pair）形成三个角落锁定区域。右下角必须在前 40% 路线内解决，否则无法回收。',
    difficultyLabel: 'Medium',
    archetypeTags: ['CORNER_LOCK']
  },
  {
    id: 'hidden-medium-13',
    title: '平衡推演',
    N: 7,
    path: [4,5,6,13,20,27,34,41,48,47,40,33,26,19,12,11,18,25,32,39,46,45,44,43,42,35,36,37,38,31,24,17,10,3,2,1,0,7,8,9,16,15,14,21,28,29,22,23,30],
    keyNumbers: [1,6,12,13,20,26,33,40,41,48,49],
    startIndex: 4,
    description: 'BALANCED_DEDUCTION：11 个关键数字，10 段，平均段长 4.8，close pair 密集（3 个）。6→12（extra=4）、33→40（extra=6）、41→48（extra=6）三段 close pair 分属三个独立区域，必须全局协调——任一区的绕行消耗过多格子，其他区就不够。',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION']
  },
  {
    id: 'hidden-medium-14',
    title: '诱饵迷途',
    N: 7,
    path: [28,21,14,7,0,1,2,3,4,5,6,13,12,11,10,9,8,15,22,29,30,23,16,17,18,19,20,27,26,25,24,31,32,33,34,41,48,47,40,39,46,45,38,37,44,43,36,35,42],
    keyNumbers: [1,2,9,10,16,23,25,31,32,35,36,39,45,49],
    startIndex: 28,
    description: 'LATE_GAME_TRAP：14 个关键数字，13 段。16→23（extra=6 close pair）是核心陷阱——曼哈顿 1 但需 7 步绕行。前半段 1→2→9→10 看似顺畅的直行诱导玩家走底边，但 23→25 的短锚点段迫使路径转向上方，如果底边已被填满就无路可走。',
    difficultyLabel: 'Medium',
    archetypeTags: ['LATE_GAME_TRAP']
  },
  {
    id: 'hidden-medium-15',
    title: '区域穿行',
    N: 7,
    path: [2,3,4,5,6,13,12,11,10,9,16,17,18,19,20,27,34,41,48,47,40,33,26,25,24,23,30,31,32,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,8,1,0],
    keyNumbers: [1,7,13,15,17,22,29,30,37,40,47,48,49],
    startIndex: 2,
    description: 'AREA_SPLIT + MULTI_REGION_ROUTE：13 个关键数字，12 段。7→13（extra=4 close pair）和 22→29（extra=6 close pair）标记两处区域通道。三个区域（顶部横区、右侧竖区、底部折返区）的遍历顺序不可颠倒——先走右侧还是先走底部，步数约束给出唯一答案。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT', 'MULTI_REGION_ROUTE']
  },
  {
    id: 'hidden-medium-16',
    title: '角落棋局',
    N: 7,
    path: [36,35,42,43,44,37,38,45,46,47,48,41,40,39,32,31,30,29,28,21,22,23,24,25,26,33,34,27,20,13,6,5,12,19,18,11,4,3,2,1,0,7,14,15,8,9,10,17,16],
    keyNumbers: [1,7,14,16,17,22,26,33,35,36,38,43,49],
    startIndex: 36,
    description: 'CORNER_LOCK + BALANCED_DEDUCTION：13 个关键数字，12 段，close pair 密集（4 个）。1→7（extra=4）和 7→14（extra=6）在开局就强制两段大绕行。四角分别由 1/14/22/43 锁定，玩家需要同时满足角落访问顺序和段长约束，绕行与留空间的权衡贯穿全关。',
    difficultyLabel: 'Medium',
    archetypeTags: ['CORNER_LOCK', 'BALANCED_DEDUCTION']
  },
  {
    id: 'hidden-medium-17',
    title: '象限漫游',
    N: 7,
    path: [12,5,6,13,20,27,34,41,48,47,46,45,44,43,42,35,36,37,38,39,40,33,26,19,18,11,4,3,2,1,0,7,8,9,10,17,16,15,14,21,28,29,22,23,30,31,32,25,24],
    keyNumbers: [1,7,11,12,19,23,29,35,37,43,49],
    startIndex: 12,
    description: 'MULTI_REGION_ROUTE：11 个关键数字，10 段，平均段长 4.8。12→19（extra=6 close pair）和 35→37（锚点短段）+ 37→43（extra=4 close pair）+ 43→49（extra=4 close pair）形成多段连续 close pair。四个象限的访问顺序是核心——象限 I→IV→II→III 是唯一正确路线。',
    difficultyLabel: 'Medium',
    archetypeTags: ['MULTI_REGION_ROUTE']
  },
  {
    id: 'hidden-medium-18',
    title: '内外博弈',
    N: 7,
    path: [48,47,46,45,44,43,42,35,28,21,14,7,0,1,8,15,22,29,36,37,30,23,16,9,2,3,4,5,6,13,20,27,34,41,40,33,26,19,12,11,10,17,18,25,24,31,32,39,38],
    keyNumbers: [1,4,6,8,10,16,23,24,28,30,31,37,43,44,49],
    startIndex: 48,
    description: 'AREA_SPLIT：15 个关键数字，14 段，close pair 密集（4 个）。外围环 vs 内部核心的双层结构。16→23（extra=6 close pair）标记内外切换通道，31→37（extra=4 close pair）和 37→43（extra=4 close pair）在后半段连续设置绕行。先外后内是唯一顺序，但外围步数必须精确控制才能给内部留够空间。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT']
  },
  {
    id: 'hidden-medium-19',
    title: '暗藏封路',
    N: 7,
    path: [44,43,42,35,28,21,14,7,0,1,2,3,4,5,6,13,12,11,10,9,8,15,16,17,18,19,20,27,26,25,24,23,22,29,36,37,30,31,38,45,46,47,48,41,34,33,40,39,32],
    keyNumbers: [1,4,5,7,13,19,25,31,38,41,47,49],
    startIndex: 44,
    description: 'LATE_GAME_TRAP：12 个关键数字，11 段，close pair 极密集（5 个）。13→19（extra=4）、19→25（extra=4）、25→31（extra=4）、31→38（extra=6）、41→47（extra=4）连续五段 close pair。前半段的低 extra 段诱导"直走就行"的错觉，但 31→38 的 6 extra close pair 是核心陷阱——如果前期走得太直接，38 之后的空间不够完成后续绕行。',
    difficultyLabel: 'Medium',
    archetypeTags: ['LATE_GAME_TRAP']
  },
  {
    id: 'hidden-medium-20',
    title: '全局调度',
    N: 7,
    path: [32,39,46,45,44,43,42,35,28,21,14,7,0,1,8,15,22,29,36,37,38,31,30,23,16,9,2,3,10,17,24,25,18,11,4,5,6,13,12,19,20,27,26,33,34,41,40,47,48],
    keyNumbers: [1,8,10,16,20,26,33,40,41,42,49],
    startIndex: 32,
    description: 'BALANCED_DEDUCTION：Medium 收尾关。11 个关键数字，10 段，平均段长 4.8。16→20→26 的三个短段提供锚定感，26→33（extra=4 close pair）和 33→40（extra=6 close pair）是核心推理段。四个独立推理区（顶部横穿、左侧竖区、中心密集、右侧收束）的步数分配必须全局协调。综合运用 AREA_SPLIT + CORNER_LOCK 次级技巧。',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION']
  }
];

export const HIDDEN_LEVELS_LIST = HIDDEN_LEVELS;

export function getHiddenLevel(index) {
  return HIDDEN_LEVELS[index] || null;
}

export function getHiddenLevelCount() {
  return HIDDEN_LEVELS.length;
}
