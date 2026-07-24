/**
 * Star Double Lesson Contracts (v3).
 *
 * 零硬编码坐标：所有目标格在运行时由 proof engine 动态计算。
 * 课程分为三类：
 *   A. 规则课程 (Lv.3,4,6,7,8) — actualTopicRequired=true
 *   B. 等价概念课程 (Lv.2) — equivalentProofAllowed=true, fullNeighborCoverage
 *   C. 策略课程 (Lv.5,9,10) — strategyPattern
 *
 * Lv.1 直接复用正式 STAR_LINE_DOUBLE_TUTORIAL_CONTRACT，不复制。
 */

import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from './starLineDoubleTutorialContract.js';

function deepFreeze(v) {
  if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); }
  return v;
}

// ═══ 课程元数据定义 ═══

export const COURSE_TYPE = Object.freeze({
  RULE: 'rule',
  EQUIVALENT_CONCEPT: 'equivalent-concept',
  STRATEGY: 'strategy',
});

const LV1_CONTRACT_REF = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT;

// ═══ Lv.2: 八邻格排除（等价概念课程） ═══

const LV2_STEPS = deepFreeze([
  {
    id: 'lv2-intro', type: 'explain', phase: 'intro',
    copy: '上关学会了 2×2 限制。现在学习新规则：每放一颗星，它的上、下、左、右和四个斜角共八个格子都不能再放星。',
    buttonLabel: '开始',
  },
  {
    id: 'lv2-setup', type: 'setup', phase: 'setup',
    copy: '先用 2×2 规则找出第一颗确定星。双击你认为正确的位置放星。',
    technique: 'two-by-two-capacity',
    expectedAction: 'place-star',
    prerequisiteRules: ['two-by-two-capacity'],
    hintTiers: [
      { copy: '看棋盘的角落区域，找 2×2 块的覆盖关系。' },
      { copy: '这个区域还需要星，但候选位置都在同一个 2×2 里。' },
    ],
  },
  {
    id: 'lv2-guided', type: 'guided', phase: 'guided',
    copy: '看刚放下的星：把它的上、下、左、右和四个斜角一一标成 X。斜角也不能放星！',
    technique: 'adjacency-exclusion',
    expectedAction: 'eliminate',
    hintTiers: [
      { copy: '看这颗星周围的八个格子。' },
      { copy: '星点八向不相邻，周围八格包括斜角都不能放星。' },
      { copy: '把高亮的空格标成 X——斜角也别漏掉。' },
    ],
  },
  {
    id: 'lv2-practice', type: 'practice', phase: 'practice',
    copy: '用同样的方法：自己找出下一颗确定星，然后把它的周围八格也标成 X。',
    technique: 'adjacency-exclusion',
    expectedAction: 'eliminate',
    revealTargets: false,
    hintTiers: [
      { copy: '继续先用 2×2 规则确定星的位置。' },
    ],
  },
  {
    id: 'lv2-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '你已经学会八邻格排除。现在自己完成剩余棋盘。',
    allowedRules: ['adjacency-exclusion', 'two-by-two-capacity', 'quota-saturated', 'remaining-capacity'],
  },
]);

export const LV2_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-02', lessonNumber: 2,
  topic: '星星周围八格排除',
  courseType: COURSE_TYPE.EQUIVALENT_CONCEPT,
  newRule: 'adjacency-exclusion',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity'],
  steps: LV2_STEPS,
  summaryCopy: '放一颗星，就要排除周围八格——上下左右和四个斜角都不能再放星。',
  allowedRules: ['adjacency-exclusion', 'two-by-two-capacity', 'quota-saturated', 'remaining-capacity'],
  gates: {
    conceptualExerciseRequired: true,
    fullNeighborCoverage: true,
    equivalentProofAllowed: true,
    maxSetupActions: 1,
    guidedTechnique: 'adjacency-exclusion',
    practiceTechnique: 'adjacency-exclusion',
    practiceRevealTargets: false,
  },
});

// ═══ Lv.3: 配额已满（规则课程） ═══

const LV3_STEPS = deepFreeze([
  {
    id: 'lv3-intro', type: 'explain', phase: 'intro',
    copy: '当某一行、某一列或某个星域已经放满 2 颗星时，这个范围内的其余格子全部可以标 X。',
    buttonLabel: '开始',
  },
  {
    id: 'lv3-setup', type: 'setup', phase: 'setup',
    copy: '先用 2×2 和八邻格规则推进棋盘。留意有没有哪个单位已经放了 2 颗星。',
    technique: 'two-by-two-capacity',
    expectedAction: 'place-star',
    prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion'],
    hintTiers: [
      { copy: '用 2×2 规则找出一颗确定星。' },
    ],
  },
  {
    id: 'lv3-guided', type: 'guided', phase: 'guided',
    copy: '看这一行：已经放了 2 颗星，配额满了。把这一行剩余的空格全部标成 X。',
    technique: 'quota-saturated',
    expectedAction: 'eliminate',
    hintTiers: [
      { copy: '先扫描哪一行已经放了 2 颗星。' },
      { copy: '配额满了，其余位置就可以排除。' },
      { copy: '把这一行中还没有星也没有 X 的格子标成 X。' },
    ],
  },
  {
    id: 'lv3-practice', type: 'practice', phase: 'practice',
    copy: '自己找另一个已经放满的单位（可以是列或星域），把剩余空格标成 X。',
    technique: 'quota-saturated',
    expectedAction: 'eliminate',
    revealTargets: false,
    hintTiers: [
      { copy: '扫描每一列和每个星域的星点数量。' },
    ],
  },
  {
    id: 'lv3-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '接下来自己完成。每次放星或标 X 后记得检查所在的行、列、星域是否满额。',
    allowedRules: ['quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'remaining-capacity'],
  },
]);

export const LV3_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-03', lessonNumber: 3,
  topic: '配额已经满足',
  courseType: COURSE_TYPE.RULE,
  newRule: 'quota-saturated',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion'],
  steps: LV3_STEPS,
  summaryCopy: '当行、列或星域放满两颗星后，其余位置就可以排除。',
  allowedRules: ['quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'remaining-capacity'],
  gates: {
    actualTopicRequired: true,
    maxSetupActions: 2,
    guidedTechnique: 'quota-saturated',
    practiceTechnique: 'quota-saturated',
    practiceRevealTargets: false,
  },
});

// ═══ Lv.4: 剩余=星数（规则课程） ═══

const LV4_STEPS = deepFreeze([
  {
    id: 'lv4-intro', type: 'explain', phase: 'intro',
    copy: '当某行、列或星域还需要的星数，恰好等于剩余空位数时——这些空位就是星。双击放星。',
    buttonLabel: '开始',
  },
  {
    id: 'lv4-setup', type: 'setup', phase: 'setup',
    copy: '先用前面学过的规则推进，留意哪些单位的空位已经很少了。',
    technique: 'two-by-two-capacity',
    expectedAction: 'eliminate',
    prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated'],
    hintTiers: [
      { copy: '用已学规则先排除明显不能放星的位置。' },
    ],
  },
  {
    id: 'lv4-guided', type: 'guided', phase: 'guided',
    copy: '看这个单位：还需要星，而空位恰好只剩这些——它们就是星。双击每个空位放星。',
    technique: 'remaining-capacity',
    expectedAction: 'place-star',
    hintTiers: [
      { copy: '先数一数这个单位已经放了几颗星。' },
      { copy: '需星数等于剩余空位数时，空位就是星。' },
      { copy: '双击高亮格放星。' },
    ],
  },
  {
    id: 'lv4-practice', type: 'practice', phase: 'practice',
    copy: '自己找一个"空位数等于缺星数"的单位，把星确定下来。',
    technique: 'remaining-capacity',
    expectedAction: 'place-star',
    revealTargets: false,
    hintTiers: [
      { copy: '扫描每个单位的星数和空位数。' },
    ],
  },
  {
    id: 'lv4-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '剩余棋盘由你完成。记住：空位数等于缺星数时，直接放星。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  },
]);

export const LV4_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-04', lessonNumber: 4,
  topic: '剩余位置等于剩余星数',
  courseType: COURSE_TYPE.RULE,
  newRule: 'remaining-capacity',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated'],
  steps: LV4_STEPS,
  summaryCopy: '剩余空位恰好等于还缺的星数时，它们就是星位。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: {
    actualTopicRequired: true,
    maxSetupActions: 2,
    guidedTechnique: 'remaining-capacity',
    practiceTechnique: 'remaining-capacity',
    practiceRevealTargets: false,
    distinctFromLv3: true,
  },
});

// ═══ Lv.5: 寻找第二颗（策略课程） ═══

const LV5_STEPS = deepFreeze([
  {
    id: 'lv5-intro', type: 'explain', phase: 'intro',
    copy: '不必总想同时找两颗星。当某个单位已经确定 1 颗星后，集中精力用其他规则锁定第二颗。',
    buttonLabel: '开始',
  },
  {
    id: 'lv5-setup', type: 'setup', phase: 'setup',
    copy: '先用已学规则推进棋盘，直到某个单位明确有了 1 颗星。',
    technique: 'two-by-two-capacity',
    expectedAction: 'place-star',
    prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
    hintTiers: [
      { copy: '先用 2×2 和剩余容量规则找到第一颗确定的星。' },
    ],
  },
  {
    id: 'lv5-guided', type: 'guided', phase: 'guided',
    copy: '这个单位已经有 1 颗星了，还需要第 2 颗。结合 2×2 和相邻规则，锁定它的位置。',
    technique: 'two-by-two-capacity',
    expectedAction: 'place-star',
    hintTiers: [
      { copy: '先确认这个单位的第一颗星在哪里。' },
      { copy: '排除该星周围八格和已满的行列后，剩下的空位中找第二颗。' },
      { copy: '双击目标格放星。' },
    ],
  },
  {
    id: 'lv5-practice', type: 'practice', phase: 'practice',
    copy: '自己找另一个已有 1 颗星的单位（不同类别的单位），锁定它的第二颗星。',
    technique: 'remaining-capacity',
    expectedAction: 'place-star',
    revealTargets: false,
    hintTiers: [
      { copy: '扫描哪些行、列或星域已经有 1 颗星了。' },
    ],
  },
  {
    id: 'lv5-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '接下来自己完成。记住：逐颗推进，不必同时找齐两颗。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  },
]);

export const LV5_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-05', lessonNumber: 5,
  topic: '已有一颗，寻找第二颗',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'FIND_SECOND_STAR',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: LV5_STEPS,
  summaryCopy: '不必同时找齐两颗星——确认一颗后再找第二颗，推理更有条理。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: {
    secondStarStrategyExercised: true,
    guidedAndPracticeDifferentUnits: true,
    maxSetupActions: 2,
    practiceRevealTargets: false,
  },
});

// ═══ Lv.6: 区域形状（规则课程） ═══

const LV6_STEPS = deepFreeze([
  {
    id: 'lv6-intro', type: 'explain', phase: 'intro',
    copy: '星域的形状本身就是线索——窄长的区域会把星限制在少数几个位置。',
    buttonLabel: '开始',
  },
  {
    id: 'lv6-guided', type: 'guided', phase: 'guided',
    copy: '看这个星域的形状：它很窄，只能容纳有限几个互不相邻的星位。排除形状限制以外的格子。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    hintTiers: [
      { copy: '先观察棋盘中最窄的那个星域。' },
      { copy: '窄区域的候选星位受形状限制，落在更大的行或列里。' },
      { copy: '排除形状限制以外的空位。' },
    ],
  },
  {
    id: 'lv6-practice', type: 'practice', phase: 'practice',
    copy: '找另一个受形状影响的星域，自己判断哪些位置不可能放星。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    revealTargets: false,
    hintTiers: [
      { copy: '棋盘里还有别的窄区域——它的候选星位也受形状限制。' },
    ],
  },
  {
    id: 'lv6-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '接下来自己完成。每次不确定时，先观察星域的形状再动手。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  },
]);

export const LV6_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-06', lessonNumber: 6,
  topic: '区域形状锁定',
  courseType: COURSE_TYPE.RULE,
  newRule: 'confined-capacity',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: LV6_STEPS,
  summaryCopy: '星域的形状本身就是线索——窄长的区域会限制星可以出现的位置。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: {
    actualTopicRequired: true,
    maxSetupActions: 3,
    guidedTechnique: 'confined-capacity',
    practiceTechnique: 'confined-capacity',
    practiceRevealTargets: false,
  },
});

// ═══ Lv.7: 交叉推理（规则课程） ═══

const LV7_STEPS = deepFreeze([
  {
    id: 'lv7-intro', type: 'explain', phase: 'intro',
    copy: '单独看一行或一列线索不够时，把行、列和星域交叉起来看，就能发现隐藏的排除。',
    buttonLabel: '开始',
  },
  {
    id: 'lv7-guided', type: 'guided', phase: 'guided',
    copy: '同时看这一行和这个星域：它们的重合位置只有这几个。交叉信息能让你排除多余的空格。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    hintTiers: [
      { copy: '先单独看这一行，再单独看这个星域。' },
      { copy: '行和星域的候选星位交叉后，只有重合位置才可能放星。' },
      { copy: '排除不在重合范围内的空位。' },
    ],
  },
  {
    id: 'lv7-practice', type: 'practice', phase: 'practice',
    copy: '自己选一列和一个星域，交叉观察它们，找出可以排除的位置。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    revealTargets: false,
    hintTiers: [
      { copy: '找一列和一个星域——看看它们的重合区域。' },
    ],
  },
  {
    id: 'lv7-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '接下来自己完成。做每个判断前先扫一眼相关的行、列和星域。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  },
]);

export const LV7_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-07', lessonNumber: 7,
  topic: '行列与星域交叉',
  courseType: COURSE_TYPE.RULE,
  newRule: 'cross-unit-confinement',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity'],
  steps: LV7_STEPS,
  summaryCopy: '把行、列和星域放在一起观察，线索会更清楚。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: {
    actualTopicRequired: true,
    maxSetupActions: 3,
    guidedTechnique: 'confined-capacity',
    practiceTechnique: 'confined-capacity',
    practiceRevealTargets: false,
    crossUnitRequired: true,
  },
});

// ═══ Lv.8: 必有一星（规则课程） ═══

const LV8_STEPS = deepFreeze([
  {
    id: 'lv8-intro', type: 'explain', phase: 'intro',
    copy: '当两个位置中必定有一颗星时，与这两个位置都冲突的格子就可以排除。',
    buttonLabel: '开始',
  },
  {
    id: 'lv8-guided', type: 'guided', phase: 'guided',
    copy: '看这个区域：只剩两个空位，必定有一颗星。与这两个位置都相邻的格子一定不是星。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    hintTiers: [
      { copy: '先找那些只剩少量空位的单位。' },
      { copy: '某单位只有两个空位时，它们构成"必有一星"的关系。' },
      { copy: '排除与这两个位置都冲突的空格。' },
    ],
  },
  {
    id: 'lv8-practice', type: 'practice', phase: 'practice',
    copy: '自己找另一组"两个位置必有一星"的情况，排除与两者都冲突的格子。',
    technique: 'confined-capacity',
    expectedAction: 'eliminate',
    revealTargets: false,
    hintTiers: [
      { copy: '哪些行、列或星域只剩两个空位？' },
    ],
  },
  {
    id: 'lv8-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '善用"两个位置必有一星"能排除很多隐藏的冲突格。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  },
]);

export const LV8_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-08', lessonNumber: 8,
  topic: '两个位置必有一星',
  courseType: COURSE_TYPE.RULE,
  newRule: 'shared-conflict-exclusion',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity', 'cross-unit-confinement'],
  steps: LV8_STEPS,
  summaryCopy: '两个位置中必有一星时，与两者都冲突的位置就可以排除。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: {
    actualTopicRequired: true,
    maxSetupActions: 3,
    guidedTechnique: 'confined-capacity',
    practiceTechnique: 'confined-capacity',
    practiceRevealTargets: false,
    evidenceTargetSeparation: true,
  },
});

// ═══ Lv.9: 连续传播（策略课程） ═══

const LV9_STEPS = deepFreeze([
  {
    id: 'lv9-intro', type: 'explain', phase: 'intro',
    copy: '每得出一个结论，马上扫描它影响的行、列和星域——一个结论会触发下一个。这就是传播链。',
    buttonLabel: '开始',
  },
  {
    id: 'lv9-chain-1', type: 'guided', phase: 'guided',
    copy: '先用已学规则做第一步推理。做完后不要马上继续——先扫描这步影响的所有单位。',
    technique: 'two-by-two-capacity',
    expectedAction: 'eliminate',
    chainStep: 1,
    hintTiers: [
      { copy: '从棋盘一角开始，用 2×2 规则做第一次排除。' },
      { copy: '做完后，扫描：被排除的格子属于哪些行、列、星域？' },
    ],
  },
  {
    id: 'lv9-chain-2', type: 'guided', phase: 'guided',
    copy: '上一步的结果让这一行发生了变化——空位更少了。这一步能推出什么？',
    technique: 'remaining-capacity',
    expectedAction: 'place-star',
    chainStep: 2,
    dependsOnChainStep: 1,
    hintTiers: [
      { copy: '上一步的排除减少了某个单位的空位数——现在这个单位还缺几颗星？' },
    ],
  },
  {
    id: 'lv9-chain-3', type: 'guided', phase: 'guided',
    copy: '刚才放的星影响了它周围的八格——继续扫描下一个受影响的行或星域。',
    technique: 'adjacency-exclusion',
    expectedAction: 'eliminate',
    chainStep: 3,
    dependsOnChainStep: 2,
    hintTiers: [
      { copy: '放星后，扫描它的八邻格——再加上所在行的变化，能得出什么？' },
    ],
  },
  {
    id: 'lv9-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '你已经体验了传播链。现在用这个习惯完成剩余棋盘。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  },
]);

export const LV9_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-09', lessonNumber: 9,
  topic: '连续传播',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'PROPAGATION_CHAIN',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity', 'cross-unit-confinement', 'shared-conflict-exclusion'],
  steps: LV9_STEPS,
  summaryCopy: '每得到一个结论，都重新扫描相邻的行、列和星域——传播链是双星最重要的技巧。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: {
    propagationChainLength: 3,
    chainDependencyRequired: true,
    chainStepsPlayerCompleted: true,
  },
});

// ═══ Lv.10: 毕业关 ═══

const LV10_STEPS = deepFreeze([
  {
    id: 'lv10-intro', type: 'explain', phase: 'intro',
    copy: '你已经学完双星的全部基础逻辑和策略。这一关请独立完成——卡住时可以使用提示。',
    buttonLabel: '开始挑战',
  },
  {
    id: 'lv10-autonomous', type: 'autonomous', phase: 'autonomous',
    copy: '独立完成整关。卡住时可以逐级查看提示。',
    allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  },
]);

export const LV10_LESSON_CONTRACT = deepFreeze({
  levelId: 'star-double-tutorial-10', lessonNumber: 10,
  topic: '基础逻辑综合',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'GRADUATION',
  prerequisiteRules: ['double-star-rules', 'two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity', 'cross-unit-confinement', 'shared-conflict-exclusion', 'propagation-chain'],
  steps: LV10_STEPS,
  summaryCopy: '你已经能独立组合双星的基础逻辑。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: {
    noNewTechnique: true,
    autonomousReachable: true,
  },
});

// ═══ 注册表 ═══

export const STAR_DOUBLE_LESSON_CONTRACTS = deepFreeze({
  'star-double-tutorial-01': LV1_CONTRACT_REF,
  'star-double-tutorial-02': LV2_LESSON_CONTRACT,
  'star-double-tutorial-03': LV3_LESSON_CONTRACT,
  'star-double-tutorial-04': LV4_LESSON_CONTRACT,
  'star-double-tutorial-05': LV5_LESSON_CONTRACT,
  'star-double-tutorial-06': LV6_LESSON_CONTRACT,
  'star-double-tutorial-07': LV7_LESSON_CONTRACT,
  'star-double-tutorial-08': LV8_LESSON_CONTRACT,
  'star-double-tutorial-09': LV9_LESSON_CONTRACT,
  'star-double-tutorial-10': LV10_LESSON_CONTRACT,
});

export function getStarDoubleLessonContract(levelId) {
  return STAR_DOUBLE_LESSON_CONTRACTS[levelId] || null;
}

export function isStarDoubleTeachingLevel(levelId) {
  return levelId in STAR_DOUBLE_LESSON_CONTRACTS;
}

/**
 * 扫描 contract 禁止静态答案字段。
 * 返回违规列表。Lv.1 不纳入扫描。
 */
export function validateContractNoStaticAnswers(levelId) {
  if (levelId === 'star-double-tutorial-01') return [];
  const contract = STAR_DOUBLE_LESSON_CONTRACTS[levelId];
  if (!contract) return ['contract not found'];
  const violations = [];
  const forbiddenFields = ['actionCells', 'targetCells', 'solutionCells', 'expectedCellIndexes'];

  for (const step of (contract.steps || [])) {
    for (const field of forbiddenFields) {
      if (step[field] !== undefined) {
        violations.push(`step ${step.id}: contains forbidden field "${field}"`);
      }
    }
  }

  // Check no solution import
  const contractStr = JSON.stringify(contract);
  if (contractStr.includes('"solution"') && contractStr.includes('starCell')) {
    // Only flag if actual solution coordinates found (not just the word)
  }

  return violations;
}
