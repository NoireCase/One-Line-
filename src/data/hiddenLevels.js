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
  // Medium 阶段：7×7 首批 10 关 (#11–#20) — 质量升级版
  // 6 种不同 shapeTag，路径轮廓明显不同
  // ═══════════════════════════════════════

  {
    id: 'hidden-medium-11',
    title: '螺旋迷宫',
    N: 7,
    path: [24,31,30,23,16,17,18,25,32,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,26,27,20],
    keyNumbers: [1,2,9,16,17,22,29,30,35,41,44,49],
    startIndex: 24,
    description: 'SPIRAL 形状，7×7 入门关。12 个关键数字，11 段，平均 4.4 步。起点在中心(3,3)，路径从内向外螺旋展开。段 22→29（extra=4 close pair）和 30→35（extra=4 close pair）是两处核心绕行。',
    difficultyLabel: 'Medium',
    archetypeTags: ['SPIRAL'],
    shapeTag: 'SPIRAL'
  },
  {
    id: 'hidden-medium-12',
    title: '涡卷推理',
    N: 7,
    path: [24,25,32,31,30,23,16,17,18,19,26,27,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,34,33,40],
    keyNumbers: [1,6,10,17,18,21,27,32,35,42,48,49],
    startIndex: 24,
    description: 'SPIRAL 变体。12 个关键数字，11 段。起点在(3,3)，与 #11 同起点不同螺旋方向（顺时针 vs 逆时针），路径终点和填充模式完全不同。段 17→18（锚点短段）后接 18→21（仅 3 步但曼哈顿 1，需绕行 close pair）。',
    difficultyLabel: 'Medium',
    archetypeTags: ['SPIRAL'],
    shapeTag: 'SPIRAL'
  },
  {
    id: 'hidden-medium-13',
    title: '先外后内',
    N: 7,
    path: [26,27,20,13,6,5,4,3,2,1,0,7,8,9,10,11,12,19,18,25,32,33,34,41,48,47,40,39,46,45,38,31,24,17,16,15,14,21,22,23,30,37,44,43,42,35,28,29,36],
    keyNumbers: [1,2,3,10,15,21,28,35,41,42,43,49],
    startIndex: 26,
    description: 'REGION_LOCKED 形状，区域封锁型。12 个关键数字，11 段。路径被中轴线拦腰分为上下两个区域。1→2→3 的短锚定段后紧跟 3→10 长段（7 步），必须在狭窄的上区完成大量填充才能进入下区。段 35→41（close pair）是区域通道标记。',
    difficultyLabel: 'Medium',
    archetypeTags: ['REGION_LOCKED', 'AREA_SPLIT'],
    shapeTag: 'REGION_LOCKED'
  },
  {
    id: 'hidden-medium-14',
    title: '区域突破',
    N: 7,
    path: [26,27,20,19,12,13,6,5,4,11,18,25,32,33,34,41,48,47,40,39,46,45,38,31,24,17,10,3,2,1,0,7,14,21,28,35,42,43,44,37,36,29,30,23,22,15,16,9,8],
    keyNumbers: [1,4,10,13,20,22,28,34,36,42,48,49],
    startIndex: 26,
    description: 'REGION_LOCKED 变体，CORNER_LOCK 叠加。12 个关键数字，11 段。棋盘右下角（段 20→22 标记）必须在进入左下区之前处理。段 13→20（7 步长段）穿越中轴，如果先走了左下角的绕行路线，右下角会因步数不够被封死。',
    difficultyLabel: 'Medium',
    archetypeTags: ['REGION_LOCKED', 'CORNER_LOCK'],
    shapeTag: 'REGION_LOCKED'
  },
  {
    id: 'hidden-medium-15',
    title: '边界先行',
    N: 7,
    path: [22,21,28,29,36,35,42,43,44,45,46,47,48,41,34,27,20,13,6,5,4,3,2,1,0,7,14,15,8,9,10,11,12,19,18,17,16,23,30,37,38,31,24,25,26,33,40,39,32],
    keyNumbers: [1,8,10,16,23,30,36,43,46,48,49],
    startIndex: 22,
    description: 'PERIMETER_FIRST 形状，外围优先型。11 个关键数字，10 段，平均段长 4.8。前 20 步中 17 步在棋盘边缘，先扫外圈再填内部。段 23→30（extra=4）标记内外切换通道。如果外围某段多绕了路，内部格子就会不够分配。',
    difficultyLabel: 'Medium',
    archetypeTags: ['PERIMETER_FIRST', 'AREA_SPLIT'],
    shapeTag: 'PERIMETER_FIRST'
  },
  {
    id: 'hidden-medium-16',
    title: '双环递进',
    N: 7,
    path: [22,21,28,35,42,43,44,45,46,47,48,41,34,27,20,13,6,5,12,19,26,33,40,39,32,25,18,11,4,3,10,17,24,31,38,37,36,29,30,23,16,9,2,1,0,7,14,15,8],
    keyNumbers: [1,8,13,15,22,29,35,38,39,46,49],
    startIndex: 22,
    description: 'PERIMETER_FIRST + LATE_GAME_TRAP，双环结构。11 个关键数字，10 段。外围环（前 24 步）和内部环（后 25 步）清晰分离。段 27→33（extra=4）和 33→34（锚点短段）标记环间切换。如果在外围环某段多走了，内部环会因空间不够无法闭合。',
    difficultyLabel: 'Medium',
    archetypeTags: ['PERIMETER_FIRST', 'LATE_GAME_TRAP'],
    shapeTag: 'PERIMETER_FIRST'
  },
  {
    id: 'hidden-medium-17',
    title: '环环相扣',
    N: 7,
    path: [0,1,2,3,4,5,6,13,20,27,34,41,48,47,46,45,44,43,42,35,28,21,14,7,8,9,10,11,12,19,26,33,40,39,38,37,36,29,22,15,16,17,18,25,32,31,30,23,24],
    keyNumbers: [1,3,10,12,19,26,33,39,41,48,49],
    startIndex: 0,
    description: 'PERIMETER_RING 形状，三层同心环结构。11 个关键数字，10 段。起点在(0,0)，路径依次填满外环→中环→内环。段 12→19（extra=4 close pair）和 26→33（7 步长段）标记环间通道。三层环的步数分配必须精确，任何一层多占了格子，内层就不够。',
    difficultyLabel: 'Medium',
    archetypeTags: ['PERIMETER_RING', 'BALANCED_DEDUCTION'],
    shapeTag: 'PERIMETER_RING'
  },
  {
    id: 'hidden-medium-18',
    title: '左右博弈',
    N: 7,
    path: [0,1,2,3,4,11,10,9,8,7,14,15,16,17,18,25,24,23,22,21,28,29,30,31,32,39,38,37,36,35,42,43,44,45,46,47,48,41,40,33,34,27,26,19,20,13,12,5,6],
    keyNumbers: [1,2,9,12,18,23,29,30,37,40,43,49],
    startIndex: 0,
    description: 'H_DOMINANT 形状 + LATE_UNLOCK，横向主导型。12 个关键数字，11 段。棋盘左侧 5 列在前 30 步填满，右侧 2 列直到后半段才能进入。段 18→23（5 步 close pair）和 29→30（锚点短段）标记左右切换点。如果左侧填得太满或不均匀，右侧入口会被提前封死。',
    difficultyLabel: 'Medium',
    archetypeTags: ['H_DOMINANT', 'LATE_UNLOCK'],
    shapeTag: 'H_DOMINANT'
  },
  {
    id: 'hidden-medium-19',
    title: '竖区穿行',
    N: 7,
    path: [0,7,14,21,28,35,42,43,36,29,22,15,8,1,2,9,16,23,30,37,44,45,38,31,24,17,10,3,4,11,18,25,32,39,46,47,48,41,34,27,20,13,6,5,12,19,26,33,40],
    keyNumbers: [1,4,11,18,25,29,36,37,38,39,46,49],
    startIndex: 0,
    description: 'V_DOMINANT + TWO_LOOPS 形状，竖向双区。12 个关键数字，11 段。路径先填左 3 列（0→18），通过底部桥（18→25）进入右 4 列（25→49）。段 36→37→38→39 的连续锚点段标记右区收束节奏，49→46（段 46→49 的 extra=4 close pair）是收尾推理关键。',
    difficultyLabel: 'Medium',
    archetypeTags: ['V_DOMINANT', 'AREA_SPLIT'],
    shapeTag: 'V_DOMINANT'
  },
  {
    id: 'hidden-medium-20',
    title: '全局交织',
    N: 7,
    path: [22,21,28,29,36,35,42,43,44,37,30,23,24,31,38,45,46,47,48,41,40,39,32,25,26,33,34,27,20,19,18,17,16,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12],
    keyNumbers: [1,4,11,16,17,24,31,34,39,46,48,49],
    startIndex: 22,
    description: 'MIXED + BALANCED_DEDUCTION，Medium 收尾关。12 个关键数字，11 段。路径综合了 PERIMETER_FIRST（前 20 步边缘率 55%）+ REGION_LOCKED（areaTrans=9）的特征。段 31→34（仅 3 步 but 曼哈顿 1，close pair）和 46→48（锚点短段）→ 48→49（close pair 收尾）形成前后呼应的难度锚点。综合运用多种推理技巧。',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION', 'REGION_LOCKED'],
    shapeTag: 'MIXED'
  }
];

export const HIDDEN_LEVELS_LIST = HIDDEN_LEVELS;

export function getHiddenLevel(index) {
  return HIDDEN_LEVELS[index] || null;
}

export function getHiddenLevelCount() {
  return HIDDEN_LEVELS.length;
}
