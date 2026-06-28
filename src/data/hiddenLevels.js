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
    title: '通道博弈',
    N: 7,
    path: [28,21,14,7,0,1,8,15,22,29,36,35,42,43,44,37,30,23,16,9,2,3,10,17,24,31,38,45,46,47,48,41,40,39,32,33,34,27,20,13,6,5,4,11,12,19,26,25,18],
    keyNumbers: [1,7,11,18,25,29,36,43,49],
    startIndex: 28,
    description: 'AREA_SPLIT：9 个关键数字，8 段，平均段长 6.0。棋盘被中轴分为左右两区。段 1→7（6 步）先在左区填满核心格，7→11（仅 4 步，extra=2 close pair）标记中轴通道——此处有 2 条可行路线，但只有一条不会封死右区后续段落。段 29→36（7 步 long segment）横跨两区。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'REGION_LOCKED'
  },
  {
    id: 'hidden-medium-17',
    title: '角落死局',
    N: 7,
    path: [26,27,34,33,32,25,18,19,20,13,6,5,12,11,4,3,10,17,24,31,38,39,40,41,48,47,46,45,44,37,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,36,43,42],
    keyNumbers: [1,8,14,21,27,33,38,43,49],
    startIndex: 26,
    description: 'CORNER_LOCK：9 个关键数字，8 段，平均段长 6.0。棋盘右下角（关键数字 8 附近）和左上角（关键数字 1）必须在前 30% 路线内访问。段 8→14（6 步）和 14→21（7 步）各有 2 条看似可行路线——如果选择直走，后期会因一个角落无法回收而失败。角落不能按顺时针扫描——必须先处理右下再处理左上。',
    difficultyLabel: 'Medium',
    archetypeTags: ['CORNER_LOCK'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-18',
    title: '诱饵暗径',
    N: 7,
    path: [4,3,2,1,0,7,14,21,28,35,42,43,36,29,22,15,8,9,10,11,18,17,16,23,24,25,26,19,12,5,6,13,20,27,34,41,48,47,40,33,32,31,30,37,44,45,46,39,38],
    keyNumbers: [1,5,9,15,21,28,33,39,46,49],
    startIndex: 4,
    description: 'LATE_GAME_TRAP：10 个关键数字，9 段，平均段长 5.3。前半段 1→5→9→15 的路径看似应该沿顶边直达——但如果走顶边，段 21→28（7 步 long segment）会发现需要大幅绕行但空间已被填满。正确走法是在段 5→9 时选择中线的"远路"，看似绕远但为后半段保留了必要通道。',
    difficultyLabel: 'Medium',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-19',
    title: '多区调度',
    N: 7,
    path: [10,3,2,1,0,7,14,21,28,35,42,43,36,29,22,15,8,9,16,23,30,37,44,45,46,47,48,41,40,39,38,31,32,33,34,27,20,13,6,5,4,11,12,19,26,25,18,17,24],
    keyNumbers: [1,8,15,21,25,30,37,43,49],
    startIndex: 10,
    description: 'BALANCED_DEDUCTION + MULTI_REGION_ROUTE：9 个关键数字，8 段，平均段长 6.0。棋盘可划分为左上密集区、右上稀疏区、底部绕行区三个独立推理单元。段 8→15（7 步长段）和 15→21（6 步 close pair）需要在三个区域间分配步数。25→30（仅 5 步 but 曼哈顿 1，close pair）迫使玩家判断区域访问顺序——先走底部再回右上，还是先右上再底部？',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION', 'MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
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
  },

  // ═══════════════════════════════════════
  // Medium 阶段：7×7 第二批 10 关 (#21–#30)
  // ═══════════════════════════════════════

  {
    id: 'hidden-medium-21',
    title: '双区抉择',
    N: 7,
    path: [16,23,22,21,14,15,8,7,0,1,2,9,10,3,4,5,6,13,12,11,18,17,24,25,32,31,30,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,20,19,26],
    keyNumbers: [1,7,13,19,21,27,34,40,43,49],
    startIndex: 16,
    description: 'AREA_SPLIT：10 个关键数字，9 段，平均 5.3 步。棋盘由中轴分为左右两区。段 7→13（6 步 close pair）在左区有 2 条可行路线——如果选择沿边缘直走，右区入口会被提前封死。段 21→27（6 步 close pair）标记右区入口，此处必须留出后续通道。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-22',
    title: '角格困局',
    N: 7,
    path: [10,3,2,9,8,1,0,7,14,15,16,17,24,23,22,21,28,29,30,31,32,25,18,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36],
    keyNumbers: [1,8,15,18,23,30,33,39,43,49],
    startIndex: 10,
    description: 'CORNER_LOCK：10 个关键数字，9 段，平均 5.3 步。棋盘左上角（关键数字 1）和右下角（段 30→33 附近）必须在前 40% 路线内处理。段 8→15（7 步 long segment）穿越中轴时，如果选择直走而不绕行，右下角区域会被提前占用导致后续无法进入。',
    difficultyLabel: 'Medium',
    archetypeTags: ['CORNER_LOCK'],
    shapeTag: 'REGION_LOCKED'
  },
  {
    id: 'hidden-medium-23',
    title: '平衡推演',
    N: 7,
    path: [32,31,38,39,46,45,44,37,30,23,24,25,18,17,16,15,22,29,36,43,42,35,28,21,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,40,47,48],
    keyNumbers: [1,6,11,17,24,30,36,43,49],
    startIndex: 32,
    description: 'BALANCED_DEDUCTION：9 个关键数字，8 段，平均 6.0 步。棋盘分为顶部扫描区、中部密集区和底部绕行区三个独立推理单元。段 6→11（5 步 close pair）在顶部区有 2 条可行路线，其中一条会让中部区的可用格数不足。三区步数必须全局协调。',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-24',
    title: '暗藏歧路',
    N: 7,
    path: [6,5,4,3,2,1,0,7,14,21,28,35,42,43,36,29,22,15,8,9,16,23,30,37,44,45,46,47,48,41,34,27,20,13,12,19,26,33,40,39,38,31,32,25,24,17,10,11,18],
    keyNumbers: [1,6,10,16,23,30,37,43,49],
    startIndex: 6,
    description: 'LATE_GAME_TRAP：9 个关键数字，8 段，平均 6.0 步。前半段 1→6→10→16 的路径看起来应该沿左边缘直下——但 16→23（7 步长段）需要横跨棋盘，如果左边缘已被填满就没有绕行空间。前半"顺路"是诱饵，必须为后半段保留横向通道。',
    difficultyLabel: 'Medium',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'CROSS_MAP'
  },
  {
    id: 'hidden-medium-25',
    title: '区域穿行',
    N: 7,
    path: [44,45,46,47,48,41,34,27,20,13,6,5,12,19,26,33,40,39,38,37,36,43,42,35,28,29,30,31,32,25,24,23,22,21,14,15,16,17,18,11,4,3,10,9,2,1,0,7,8],
    keyNumbers: [1,8,14,20,26,32,37,44,49],
    startIndex: 44,
    description: 'AREA_SPLIT + MULTI_REGION_ROUTE：9 个关键数字，8 段，平均 6.0 步。棋盘分为底部横区、右侧竖区和左上绕行区。段 8→14（6 步 close pair）有 2 条路线——直走上顶边 vs 绕行中线。直走看似省步，但会提前占用右侧竖区的入口格。区域访问顺序：底区→右区→左上区是唯一正确路线。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT', 'MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-26',
    title: '角落天平',
    N: 7,
    path: [4,3,2,1,0,7,14,21,28,35,42,43,36,29,22,15,8,9,16,23,30,37,44,45,46,47,48,41,34,27,20,13,6,5,12,11,10,17,24,31,38,39,40,33,32,25,26,19,18],
    keyNumbers: [1,4,9,15,22,29,36,39,46,49],
    startIndex: 4,
    description: 'CORNER_LOCK + BALANCED_DEDUCTION：10 个关键数字，9 段，平均 5.3 步。棋盘左上角（1）和右下角（段 39→46 附近）形成双角落约束。段 4→9（5 步 close pair）在开局就迫使做出选择——绕行会消耗棋盘中央格，而这些格是后期角落回收的必经之路。',
    difficultyLabel: 'Medium',
    archetypeTags: ['CORNER_LOCK', 'BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-27',
    title: '象限调度',
    N: 7,
    path: [10,3,4,11,18,17,24,25,32,31,38,39,40,33,26,19,12,5,6,13,20,27,34,41,48,47,46,45,44,43,42,35,36,37,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28],
    keyNumbers: [1,4,9,15,22,29,36,39,46,49],
    startIndex: 10,
    description: 'MULTI_REGION_ROUTE：10 个关键数字，9 段，平均 5.3 步。四象限的访问顺序是核心推理。段 9→15（6 步）有 2 条路线——走右上象限 vs 走左下象限。如果先走右上，左下会因步数限制无法完整遍历。正确顺序：左下→右上→右下→左上。',
    difficultyLabel: 'Medium',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-28',
    title: '内外迷局',
    N: 7,
    path: [34,41,48,47,40,33,26,27,20,19,18,25,32,39,46,45,38,31,24,17,10,11,12,13,6,5,4,3,2,1,0,7,8,9,16,23,30,37,44,43,42,35,36,29,28,21,22,15,14],
    keyNumbers: [1,7,13,18,23,30,37,44,49],
    startIndex: 34,
    description: 'AREA_SPLIT：9 个关键数字，8 段，平均 6.0 步。棋盘外围环和内部核心双层结构。段 23→30（7 步长段）标记内外切换点——如果在外围环填充时过于偏重某一侧，内部核心的入口会被不对称占用。内外步数分配必须均衡。',
    difficultyLabel: 'Medium',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-29',
    title: '诱饵深径',
    N: 7,
    path: [16,17,10,3,2,9,8,1,0,7,14,15,22,21,28,29,36,35,42,43,44,45,46,47,48,41,34,27,20,13,6,5,4,11,12,19,18,25,26,33,40,39,32,31,24,23,30,37,38],
    keyNumbers: [1,7,13,17,23,29,36,43,49],
    startIndex: 16,
    description: 'LATE_GAME_TRAP：9 个关键数字，8 段，平均 6.0 步。前半段 1→7→13→17 的密集关键数字诱导"直走即可"的惯性。段 17→23（6 步 close pair）是关键陷阱——如果在此处选择了看起来最直接的路线，后期段 29→36（7 步长段）会发现绕行空间已被预占。为后期留空间意味着前半段要主动绕远。',
    difficultyLabel: 'Medium',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-medium-30',
    title: '全局大考',
    N: 7,
    path: [30,37,44,45,38,31,32,39,46,47,48,41,40,33,34,27,26,25,24,23,22,29,36,43,42,35,28,21,14,15,16,17,18,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8],
    keyNumbers: [1,6,12,16,23,30,33,40,43,49],
    startIndex: 30,
    description: 'BALANCED_DEDUCTION — Medium 收尾关。10 个关键数字，9 段，平均 5.3 步。综合了 AREA_SPLIT（中轴分区）+ CORNER_LOCK（左上角 1 需早期处理）+ LATE_GAME_TRAP（段 16→23 的 2 条路线，其中一条封死后路）。棋盘分为四区，步数约束全局协调。需要同时运用 #11–#29 所学的全部推理技巧。',
    difficultyLabel: 'Medium',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },

  // ═══════════════════════════════════════
  // Hard 阶段：7×7 首批 10 关 (#31–#40)
  // ═══════════════════════════════════════

  {
    id: 'hidden-hard-31',
    title: '长跨开局',
    N: 7,
    path: [30,23,24,31,32,25,18,17,16,9,10,11,4,3,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12],
    keyNumbers: [1,7,10,19,28,35,43,49],
    startIndex: 30,
    description: 'Hard 入门。8 个关键数字，7 段，平均 6.9 步。段 10→19（extra=8 close pair + long segment）是开局核心——曼哈顿仅 1 但需 9 步，有 4 条路线可选，其中 3 条会封死后段。段 19→28 和 28→35 形成连续后果链（consecChains=4）——前段的绕行方向直接决定后段的可用空间。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-32',
    title: '暗渡迷局',
    N: 7,
    path: [32,25,24,31,30,23,16,17,18,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,26,27,34],
    keyNumbers: [1,8,16,24,32,39,46,49],
    startIndex: 32,
    description: 'Hard 标准，LATE_GAME_TRAP。8 个关键数字，7 段，consecChains=5。段 8→16（extra=6 close pair）在前半段——玩家倾向走外围绕行，但外围路线会填满右下角。段 32→39→46 的连续 extra=4 链是后期陷阱——前半外围填满后，后期只能走内线，但内线在段 16→24 时已被部分占用。正确路线需在段 8→16 选择"远路"内线。',
    difficultyLabel: 'Hard',
    archetypeTags: ['LATE_GAME_TRAP', 'BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-33',
    title: '四区制衡',
    N: 7,
    path: [30,31,32,25,24,23,16,17,18,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,12,13,6],
    keyNumbers: [1,6,15,24,33,40,49],
    startIndex: 30,
    description: 'Hard 偏难，BALANCED_DEDUCTION。7 个关键数字，6 段，平均 8.0 步。consecChains=5——几乎全部段都跨后果链。段 24→33（extra=6 long segment）将棋盘分为四个必须协调的推理区。1→6（extra=4 close pair）开局就要求大幅绕行，绕行方向影响后三区格子分配。段 40→49（9 步 long segment）收尾，前半多占一格后半就不够。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION', 'MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-34',
    title: '双重陷阱',
    N: 7,
    path: [18,25,32,31,24,17,16,23,30,29,22,15,14,21,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8],
    keyNumbers: [1,4,10,19,28,36,43,49],
    startIndex: 18,
    description: 'Hard 标准，LATE_GAME_TRAP 双重陷阱。8 个关键数字，7 段。段 10→19（extra=8 close pair + long segment）是第一重陷阱——4 条路线中 1 条正确。段 19→28（9 步 long segment）是第二重——选择外围直走 vs 中线绕行。双陷阱形成跨 3 段后果链。consecChains=5。',
    difficultyLabel: 'Hard',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-35',
    title: '角域困局',
    N: 7,
    path: [22,21,28,35,42,43,36,29,30,23,24,31,32,25,18,17,16,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44],
    keyNumbers: [1,10,16,23,27,33,42,49],
    startIndex: 22,
    description: 'Hard 偏难，CORNER_LOCK + BALANCED_DEDUCTION。8 个关键数字，7 段。段 1→10（extra=8 close pair + long segment）开局 9 步走 MD=1——满级大绕行。段 16→23（extra=4）标记右下角的必须提前访问节点。段 27→33（close pair）和 33→42（long segment）形成后期角落回收的连续约束。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK', 'BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-36',
    title: '双区博弈',
    N: 7,
    path: [24,23,16,17,18,25,32,31,30,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36],
    keyNumbers: [1,6,14,22,26,34,43,49],
    startIndex: 24,
    description: 'Hard 标准，AREA_SPLIT。8 个关键数字，7 段。段 1→6（extra=4 close pair）和 6→14（8 步）在左上区开局。段 26→34（8 步）和 34→43（9 步 long segment）横跨棋盘——此处有 3 条路线可选，其中 2 条会提前占用右侧收束区的必经格子。consecChains=4。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-37',
    title: '连锁约束',
    N: 7,
    path: [32,25,26,27,34,33,40,41,48,47,46,39,38,45,44,43,42,35,36,37,30,31,24,23,16,17,18,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8,15,14,21,28,29,22],
    keyNumbers: [1,7,13,21,25,34,43,49],
    startIndex: 32,
    description: 'Hard 标准，MULTI_REGION_ROUTE。8 个关键数字，7 段。段 1→7→13→21 前三段连续 close pair（extra=4,4,6），每段都有多选路线。段 21→25（锚定短段 extra=2）打断节奏后，段 25→34→43 连续两个 long segment（各 9 步 extra=6）构成后期高压。区域访问顺序不可颠倒——先右上再左下。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-38',
    title: '隐径暗藏',
    N: 7,
    path: [16,23,22,21,14,15,8,7,0,1,2,9,10,3,4,5,6,13,12,11,18,17,24,25,32,31,30,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,20,19,26],
    keyNumbers: [1,6,14,16,25,33,42,49],
    startIndex: 16,
    description: 'Hard 进阶，CORNER_LOCK。8 个关键数字，7 段，gapStd=2.4（极不均匀节奏）。段 14→16（仅 2 步锚定短段）打断前期长段节奏。段 16→25（9 步 long segment）和 25→33（8 步 close pair）连续跨区域大段。段 42→49（7 步 close pair）收尾段必须在前期预留右下区空间。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK', 'AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-39',
    title: '全局暗流',
    N: 7,
    path: [24,31,38,45,46,39,32,25,18,17,16,23,30,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40],
    keyNumbers: [1,10,19,28,36,45,49],
    startIndex: 24,
    description: 'Hard 偏难，BALANCED_DEDUCTION。7 个关键数字，6 段，平均 8.0 步。段 1→10（extra=8 close pair + long segment）开局满级大绕行。段 19→28 和 28→36 连续 long segment（各 9 步 extra=4）构成核心推理链。四区步数分配必须在段 1→10 做出预判——前三段的绕行方向决定后三段的区域可用性。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-40',
    title: '大考终局',
    N: 7,
    path: [18,25,32,33,34,27,26,19,20,13,6,5,12,11,4,3,10,17,24,31,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40],
    keyNumbers: [1,8,16,25,33,39,46,49],
    startIndex: 18,
    description: 'Hard 收尾关，综合大考。8 个关键数字，7 段。综合了 AREA_SPLIT（段 8→16 中轴分区）+ CORNER_LOCK（1 和 46 的角格约束）+ LATE_GAME_TRAP（段 16→25 extra=8 的路线陷阱）+ BALANCED_DEDUCTION（段 25→33→39→46 连续后果链）。需要同时运用 #31–#39 的全部推理技巧。gapStd=1.8，key 间隔完全不均匀——玩家不能靠节奏感猜路线。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },

  // ═══════════════════════════════════════
  // Hard 阶段：7×7 中段 10 关 (#41–#50)
  // ═══════════════════════════════════════

  {
    id: 'hidden-hard-41',
    title: '中轴长链',
    N: 7,
    path: [18,17,24,25,32,31,30,23,16,9,10,11,4,3,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,12,5,6],
    keyNumbers: [1,7,13,22,31,40,49],
    startIndex: 18,
    description: 'Hard 中段入门，AREA_SPLIT。7 个关键数字，6 段，平均 8.0 步。段 7→13（direct，extra=0）是唯一无绕行段——玩家必须精确判断这 6 步的终点位置。段 13→22（long segment）有 3 条路线横跨中轴。0 close pair。consecHigh=3。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-42',
    title: '短锚陷阱',
    N: 7,
    path: [26,27,34,33,32,25,24,31,30,23,16,17,18,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,40,41,48],
    keyNumbers: [1,10,14,23,32,41,49],
    startIndex: 26,
    description: 'Hard 标准，LATE_GAME_TRAP。7 个关键数字，6 段。段 10→14（仅 4 步 direct）是短锚点——它在长段之间制造了一个"看似简单但必须精确"的位置约束。段 14→23（extra=6 long segment）有 4 条路线，3 条会提前占用段 32→41 的必经区域。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-43',
    title: '非对称角锁',
    N: 7,
    path: [38,45,46,39,32,31,24,25,18,17,16,23,30,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40],
    keyNumbers: [1,10,19,23,31,40,49],
    startIndex: 38,
    description: 'Hard 标准，CORNER_LOCK。7 个关键数字，6 段。段 19→23（短锚点 4 步 extra=2）打断了前后长段——它是左上角区域访问的"强制提前"信号。玩家在段 10→19 绕路时选择不同方向，到了 23 时如果位置不对，左上角已无法访问。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-44',
    title: '双锁制衡',
    N: 7,
    path: [24,25,32,31,30,23,22,29,28,21,14,7,0,1,8,15,16,17,18,11,10,9,2,3,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,36,35,42],
    keyNumbers: [1,6,15,22,31,40,49],
    startIndex: 24,
    description: 'Hard 偏难，BALANCED_DEDUCTION。7 个关键数字，6 段。consecHigh=6——全段跨后果链。两个 close pair（1→6 和 15→22）不打在一处，而是分别锁定左上和右下两个独立区域。段 22→31 有 3 条路线分叉，每条对应不同区域占用模式。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-45',
    title: '单向通道',
    N: 7,
    path: [32,25,18,17,24,31,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10],
    keyNumbers: [1,6,15,24,32,40,49],
    startIndex: 32,
    description: 'Hard 偏难，MULTI_REGION_ROUTE + CORNER_LOCK。7 个关键数字，6 段。段 15→24 是"单向通道"——棋盘右上区域只有一条窄通道可以进入。段 6→15 的路线方向决定了通道是否可访问。区域访问必须按非对称顺序：左下→右下→右上→左上。1 个 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE', 'CORNER_LOCK'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-46',
    title: '双区暗锁',
    N: 7,
    path: [22,21,14,15,16,23,24,17,18,25,32,31,30,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10,9,2,1,8,7,0],
    keyNumbers: [1,10,19,24,31,40,49],
    startIndex: 22,
    description: 'Hard 偏难，AREA_SPLIT + LATE_GAME_TRAP。7 个关键数字，6 段。段 19→24（短段 5 步）将棋盘切分为上区/下区两个独立推理域。段 10→19 在上区消耗过多→段 24→31 在下区不够→但后果到段 31→40 才暴露。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT', 'LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-47',
    title: '无声锁钥',
    N: 7,
    path: [30,31,24,23,16,17,18,25,32,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38],
    keyNumbers: [1,5,14,23,31,40,49],
    startIndex: 30,
    description: 'Hard 偏难，CORNER_LOCK + BALANCED_DEDUCTION。7 个关键数字，6 段。段 1→5（短段 4 步）是开局锚点——位置敏感的选择影响跨 3 段后的段 14→23。1→5 的落点选择不可逆——选错后到 14→23 才发现冲突。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK', 'BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-48',
    title: '明暗双线',
    N: 7,
    path: [10,3,2,9,16,17,24,23,30,31,32,25,18,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8],
    keyNumbers: [1,10,15,22,31,40,49],
    startIndex: 10,
    description: 'Hard 偏难，MULTI_REGION_ROUTE。7 个关键数字，6 段。段 10→15（仅 5 步 direct extra=0）在被前后长段锁定的空间中精确定位——空间稀缺性的体现。段 22→31 有 2 条路线：绕行消耗右下区 vs 直穿消耗中区。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-49',
    title: '深段预告',
    N: 7,
    path: [16,17,10,3,2,9,8,1,0,7,14,15,22,21,28,35,42,43,36,29,30,23,24,31,32,25,18,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44],
    keyNumbers: [1,10,19,28,36,40,49],
    startIndex: 16,
    description: 'Hard 深段预告，偏难。7 个关键数字，6 段。段 36→40（仅 4 步 extra=2）是极短锚点——在三个连续 long segment 后突然插入，迫使后期精确判断。段 19→28（extra=2）看似可直接走但空间已被段 10→19 占用。consecHigh=2，刻意降低连续约束密度来测试不同 Hard 节奏。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-50',
    title: '终局平衡',
    N: 7,
    path: [36,35,42,43,44,37,38,45,46,39,32,31,30,29,28,21,22,23,24,25,18,17,16,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,40,47,48],
    keyNumbers: [1,7,16,25,31,40,49],
    startIndex: 36,
    description: 'Hard 中段收尾关，BALANCED_DEDUCTION 综合大考。7 个关键数字，6 段。综合 AREA_SPLIT（段 7→16 跨中轴）+ CORNER_LOCK（1 在角落，25 在中心区的角格约束）+ LATE_GAME_TRAP（段 16→25 extra=8 close pair + long segment 的 4 路线陷阱）+ BALANCED_DEDUCTION（段 31→40→49 连续后果链）。需同时运用 #31–#49 全部 Hard 推理技巧。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },

  // ═══════════════════════════════════════
  // Hard 阶段：7×7 最终 10 关 (#51–#60)
  // ═══════════════════════════════════════

  {
    id: 'hidden-hard-51',
    title: '深段启门',
    N: 7,
    path: [32,25,24,31,30,23,16,17,18,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4,5,12,13,6],
    keyNumbers: [1,5,14,23,31,40,49],
    startIndex: 32,
    description: 'Hard 深段入口，AREA_SPLIT + 跨区后果链。7 个关键数字，6 段，consecHigh=5。段 1→5（仅 4 步 extra=2）是极短开局锚点——第一步就暴露区域偏好。段 5→14 和 14→23 连续两个 extra=6 long segment 构成中轴双向通道。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-52',
    title: '延迟暴露',
    N: 7,
    path: [18,17,24,25,32,31,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10],
    keyNumbers: [1,6,15,24,32,40,49],
    startIndex: 18,
    description: 'LATE_GAME_TRAP，延迟暴露型。7 个关键数字，6 段。段 1→6（5 步 extra=2）的锚点位置在棋盘中心区边缘——看似安全但决定了段 15→24 是否可穿越中轴。段 24→32（8 步 extra=4）和 32→40（8 步 extra=4）是两个相对较短的后期段，但前期选择会压缩它们可用空间。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-53',
    title: '短锚分界',
    N: 7,
    path: [22,21,28,29,30,23,24,31,32,25,18,17,16,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,36,35,42],
    keyNumbers: [1,10,14,23,32,41,49],
    startIndex: 22,
    description: 'BALANCED_DEDUCTION。7 个关键数字，6 段。段 10→14（仅 4 步 direct extra=0）是极短精确锚点——在被前后长段压缩的空间中必须精确落点。段 14→23（extra=6 long segment）有 3 条路线跨过中轴，每条的落点不同，决定了下半区 23→32 的起点可达性。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-54',
    title: '角落终局',
    N: 7,
    path: [10,3,4,11,18,17,24,25,32,31,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12],
    keyNumbers: [1,10,19,23,31,40,49],
    startIndex: 10,
    description: 'CORNER_LOCK，高压角落回收。7 个关键数字，6 段。段 19→23（仅 4 步 extra=2）是角落锁信号——如果段 10→19 的绕行方向偏离了左上区，到了 23 时左上角的 1 已经无法回收。角落不按几何方向回收，由段长约束强制执行。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-55',
    title: '双锁深阱',
    N: 7,
    path: [18,17,10,3,4,11,12,5,6,13,20,19,26,27,34,41,48,47,40,33,32,25,24,31,30,23,16,9,2,1,0,7,8,15,14,21,22,29,28,35,42,43,36,37,44,45,38,39,46],
    keyNumbers: [1,7,13,22,31,40,49],
    startIndex: 18,
    description: 'Hard 深阱，双 close pair + 跨区后果链。7 个关键数字，6 段。段 1→7 和 7→13 是连续两个 close pair（extra=4,4），但它们服务于区域锁而非近点绕行——两段共同决定段 13→22 的落点。段 13→22（extra=8 close pair + long segment）有 4 条路线。3 个 close pair 跨 3 段但不连续锁在同一区域——分别锁在左上、中轴、右下。',
    difficultyLabel: 'Hard',
    archetypeTags: ['CORNER_LOCK', 'BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-56',
    title: '终区调度',
    N: 7,
    path: [30,23,22,21,28,29,36,35,42,43,44,37,38,45,46,47,48,41,40,39,32,31,24,25,18,17,16,15,14,7,0,1,8,9,2,3,10,11,4,5,6,13,12,19,20,27,26,33,34],
    keyNumbers: [1,10,19,28,36,40,49],
    startIndex: 30,
    description: 'MULTI_REGION_ROUTE，四区非对称顺序。7 个关键数字，6 段。段 36→40（仅 4 步 extra=2）是极短后期锚点——在 28→36（8 步）和 40→49（9 步）之间插入精确位置检验。区域顺序：右上→中左→右下→左上，不可颠倒。consecHigh=2，刻意降低密度测试不同 Hard 节奏。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-57',
    title: '暗锁明钥',
    N: 7,
    path: [10,3,2,9,16,17,24,23,30,31,32,25,18,11,4,5,6,13,12,19,20,27,26,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8],
    keyNumbers: [1,10,19,24,31,40,49],
    startIndex: 10,
    description: 'AREA_SPLIT + LATE_GAME_TRAP。7 个关键数字，6 段。段 19→24（5 步 extra=2）是区域分界锚点——将棋盘切分为上区和下区。段 1→10（extra=6 long segment）在上区消耗格子→段 24→31（7 步）在下区空间受制→后果到段 31→40 暴露。前半选择跨 3 段后才暴露错误。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['AREA_SPLIT', 'LATE_GAME_TRAP'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-58',
    title: '无声陷阵',
    N: 7,
    path: [16,15,14,21,22,23,24,17,18,25,32,31,30,29,28,35,42,43,36,37,44,45,38,39,46,47,48,41,40,33,34,27,26,19,20,13,6,5,12,11,4,3,10,9,2,1,8,7,0],
    keyNumbers: [1,10,19,28,37,41,49],
    startIndex: 16,
    description: 'Hard 深段，四段连续 long segment。7 个关键数字，6 段。段 1→10→19→28→37 是四个连续 extra=6/4/4/4 的长段链——没有短锚点打断节奏，玩家必须在每一段都精确判断落点。段 37→41（仅 4 步 extra=2）是唯一的后期短锚点，检验前四段是否封死了收尾空间。consecHigh=4。0 close pair。',
    difficultyLabel: 'Hard',
    archetypeTags: ['MULTI_REGION_ROUTE'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-59',
    title: '最终前哨',
    N: 7,
    path: [26,27,20,13,6,5,12,19,18,25,24,17,16,23,30,31,32,33,34,41,48,47,40,39,46,45,38,37,44,43,42,35,36,29,28,21,22,15,14,7,0,1,8,9,2,3,10,11,4],
    keyNumbers: [1,10,15,22,31,40,49],
    startIndex: 26,
    description: 'Hard 最终前哨，BALANCED_DEDUCTION。7 个关键数字，6 段。段 1→10（extra=8 close pair + long segment）开局大绕行——棋盘仅此一处 extra=8。段 10→15（5 步 extra=2）是短锚打断——检验 1→10 的方向是否正确。三区步数分配：1→10 左区、10→22 中区、22→40 右区、40→49 收束。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
    shapeTag: 'MIXED'
  },
  {
    id: 'hidden-hard-60',
    title: '终局大考',
    N: 7,
    path: [36,35,42,43,44,37,38,45,46,47,48,41,40,39,32,33,34,27,26,25,24,31,30,23,22,29,28,21,14,15,16,17,18,19,20,13,6,5,12,11,4,3,10,9,2,1,8,7,0],
    keyNumbers: [1,10,15,24,31,40,49],
    startIndex: 36,
    description: 'Hidden 终局大考，综合全 Hard 技巧。7 个关键数字，6 段。综合 AREA_SPLIT（段 15→24 跨中轴长段）+ CORNER_LOCK（1 和 49 分别在棋盘两角，路径从一角出发到另一角结束）+ LATE_GAME_TRAP（段 24→31 extra=6 close pair 有 2 条路线，1 条封死后段）+ BALANCED_DEDUCTION（段 31→40→49 连续后果链）。consecHigh=4。需要同时运用 #1–#59 的全部推理技巧——从 5×5 关键数字分段到 7×7 多区域全局协调。',
    difficultyLabel: 'Hard',
    archetypeTags: ['BALANCED_DEDUCTION'],
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
