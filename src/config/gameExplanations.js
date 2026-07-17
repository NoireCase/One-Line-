// Player-facing game explanations. Keep the same rule wording at the home,
// mode, first-play, and result surfaces so each mode teaches one clear idea.
const MODE_COPY = {
  classic: {
    tag: '四向路径',
    eyebrow: '基础旅程',
    description: '从 1 出发，按数字顺序连线，覆盖整张棋盘。',
    firstHint: '从 1 出发，按顺序连接；只能上下左右移动。',
    winSubtitle: '路径已完成',
    loseTitle: '路线中断',
    loseMessage: '回到最近的确定数字，重新规划下一段。',
  },
  diagonal: {
    tag: '八向路径',
    eyebrow: '八向路径',
    description: '从 1 出发，按数字顺序连线；斜向也可以走。',
    firstHint: '从 1 出发，按顺序连接；上下左右和斜向都可以走。',
    winSubtitle: '路径已完成',
    loseTitle: '路线中断',
    loseMessage: '回到最近的确定数字，重新规划下一段。',
  },
  hidden: {
    tag: '关键数字推理',
    eyebrow: '极简推理',
    description: '利用少量关键数字，推演一条覆盖全盘的路线。',
    firstHint: '从 1 出发，先规划两个关键数字之间恰好需要走几步。',
    winSubtitle: '推理完成',
    loseTitle: '推理中断',
    loseMessage: '尝试次数已用尽。回到最近的关键数字，换一段路线再推。',
  },
  portalClassic: {
    tag: '空间传送',
    eyebrow: '空间传送',
    description: '进入入口后，手动连到高亮出口，再继续路径。',
    ruleCardSubtitle: '入口后连接高亮出口',
    firstHint: '按顺序连线；进入入口后，下一步连到高亮出口。',
    winSubtitle: '路径已完成',
    loseTitle: '传送中断',
    loseMessage: '检查入口与高亮出口之间的连接，再继续路线。',
  },
  starLine: {
    tag: '区域推理',
    eyebrow: '星域推理',
    description: '每行、每列、每片星域各放指定数量的星点；星点不能相邻。',
    winSubtitle: '规则已满足',
  },
  starSingle: {
    tag: '单星推理',
    eyebrow: '单星推理',
    description: '每行、每列、每片星域各放 1 个星点；星点不能相邻。',
    winSubtitle: '规则已满足',
  },
  starDouble: {
    tag: '双星推理',
    eyebrow: '双星推理',
    description: '每行、每列、每片星域各放 2 个星点；星点不能相邻。',
    winSubtitle: '规则已满足',
  },
};

export const getModeCopy = (modeId) => MODE_COPY[modeId] || MODE_COPY.classic;

export const getStarLineRuleCopy = (quota) => {
  if (quota === 1) return getModeCopy('starSingle').description;
  if (quota === 2) return getModeCopy('starDouble').description;
  return getModeCopy('starLine').description;
};

export const STAR_LINE_HOME_COPY = '在每行、每列和每片星域放入星点；星点不能相邻。';

export const ONE_LINE_HOME_COPY = '按数字顺序连线，找出覆盖整张棋盘的路线。';
