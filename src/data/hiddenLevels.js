/**
 * Hidden / 极简线索 关卡数据（MVP demo，5×5，6 个手工关卡）
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
  }
];

export const HIDDEN_LEVELS_LIST = HIDDEN_LEVELS;

export function getHiddenLevel(index) {
  return HIDDEN_LEVELS[index] || null;
}

export function getHiddenLevelCount() {
  return HIDDEN_LEVELS.length;
}
