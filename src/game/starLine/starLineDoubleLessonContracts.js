/**
 * Star Double Lesson Contracts v3 — adaptive proof-driven design.
 * No hardcoded coordinates. All targets derived at runtime from proof engine.
 *
 * Course types:
 *   RULE — new technique required to solve (Lv.3,4,6,7,8)
 *   EQUIVALENT_CONCEPT — demonstrates concept that overlaps with other rules (Lv.2)
 *   STRATEGY — teaches method/approach, not a new solver technique (Lv.5,9,10)
 *
 * Lv.1 uses original STAR_LINE_DOUBLE_TUTORIAL_CONTRACT directly — no copy.
 */
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from './starLineDoubleTutorialContract.js';

function deepFreeze(v) {
  if (v && typeof v === 'object') { Object.values(v).forEach(deepFreeze); Object.freeze(v); }
  return v;
}

export const COURSE_TYPE = Object.freeze({
  RULE: 'rule',
  EQUIVALENT_CONCEPT: 'equivalent-concept',
  STRATEGY: 'strategy',
});

// ═══ Shared step building blocks ═══

const INTRO_WAIT = (copy, btn = '开始') => deepFreeze([
  { id: 'intro', type: 'explain', phase: 'intro', copy, buttonLabel: btn },
]);

const AUTONOMOUS = (copy) => deepFreeze([
  { id: 'autonomous', type: 'autonomous', phase: 'autonomous', copy },
]);

const GUIDED_STEP = (id, phase, copy, technique, action, tiers) => deepFreeze({
  id, type: 'guided', phase, copy, technique, expectedAction: action, hintTiers: tiers,
});

const PRACTICE_STEP = (id, copy, technique, action, tiers) => deepFreeze({
  id, type: 'practice', phase: 'practice', copy, technique, expectedAction: action,
  revealTargets: false, hintTiers: tiers,
});

const SETUP_STEP = (id, copy, prereq) => deepFreeze({
  id, type: 'setup', phase: 'setup', copy, prerequisiteRules: prereq, expectedAction: null,
  hintTiers: [{ copy: '观察高亮区域，用已学过的规则推理。' }],
});

// ═══ Lv.2: 八邻格排除 (EQUIVALENT_CONCEPT) ═══

const LV2 = deepFreeze({
  levelId: 'star-double-tutorial-02', lessonNumber: 2,
  topic: '星星周围八格排除',
  courseType: COURSE_TYPE.EQUIVALENT_CONCEPT,
  newRule: 'adjacency-exclusion',
  prerequisiteRules: ['two-by-two-capacity'],
  steps: [
    ...INTRO_WAIT('放一颗星后，它的上、下、左、右和四个斜角共八个格子都不能再放星。本关练习这个规则。'),
    {
      id: 'lv2-setup', type: 'setup', phase: 'setup',
      copy: '先用你已经学会的 2×2 规则观察棋盘，排除可以确定的位置，直到能确定第一颗星。',
      prerequisiteRules: ['two-by-two-capacity'],
      expectedAction: null,
      hintTiers: [{ copy: '从棋盘边角区域开始，找被 2×2 块覆盖的候选位置。' }],
    },
    GUIDED_STEP('lv2-guided', 'guided',
      '看刚放的星：把周围全部八格（包括四个斜角）标成 X。',
      'adjacency-exclusion', 'eliminate', [
        { copy: '看这颗星周围。' },
        { copy: '星点八向不相邻——上下左右和四个斜角都不能放星。' },
        { copy: '把高亮的空格标成 X。别忘了斜角。' },
      ]),
    PRACTICE_STEP('lv2-practice',
      '在另一处确定一颗星，然后自己标出它周围全部八格。',
      'adjacency-exclusion', 'eliminate', [
        { copy: '继续用 2×2 和其他已学规则找下一颗确定星。' },
      ]),
    ...AUTONOMOUS('现在用八邻格规则独立完成剩余棋盘。放星后立即检查它的八邻格。'),
  ],
  summaryCopy: '放一颗星，就要排除周围八格——上下左右和四个斜角都不能再放星。',
  allowedRules: ['adjacency-exclusion', 'two-by-two-capacity', 'quota-saturated', 'remaining-capacity'],
  gates: { conceptualExerciseRequired: true, fullNeighborCoverage: true, equivalentProofAllowed: true },
});

// ═══ Lv.3: 配额已满 (RULE) ═══

const LV3 = deepFreeze({
  levelId: 'star-double-tutorial-03', lessonNumber: 3,
  topic: '配额已经满足',
  courseType: COURSE_TYPE.RULE,
  newRule: 'quota-saturated',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion'],
  steps: [
    ...INTRO_WAIT('当某一行、某一列或某个星域已经放满 2 颗星后，剩余格子全部可以标 X。'),
    SETUP_STEP('lv3-setup', '先用 2×2 和八邻格规则推进棋盘。留意有没有单位已经放了 2 颗星。', ['two-by-two-capacity', 'adjacency-exclusion']),
    GUIDED_STEP('lv3-guided', 'guided',
      '看这一行：已经放了 2 颗星，配额满了。把这一行剩余的空格全部标成 X。',
      'quota-saturated', 'eliminate', [
        { copy: '先扫描哪一行已经放了 2 颗星。' },
        { copy: '配额满了，其余位置就可以排除。' },
        { copy: '把这一行中所有空格标成 X。' },
      ]),
    PRACTICE_STEP('lv3-practice',
      '自己找另一个放满的单位（列或星域），把剩余空格标成 X。',
      'quota-saturated', 'eliminate', [
        { copy: '扫描每一列和每个星域的星点数量。' },
      ]),
    ...AUTONOMOUS('接下来自己完成。每次操作后检查相关单位的星数是否满额。'),
  ],
  summaryCopy: '当行、列或星域放满两颗星后，其余位置就可以排除。',
  allowedRules: ['quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'remaining-capacity'],
  gates: { actualTopicRequired: true },
});

// ═══ Lv.4: 剩余=星数 (RULE) ═══

const LV4 = deepFreeze({
  levelId: 'star-double-tutorial-04', lessonNumber: 4,
  topic: '剩余位置等于剩余星数',
  courseType: COURSE_TYPE.RULE,
  newRule: 'remaining-capacity',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated'],
  steps: [
    ...INTRO_WAIT('某单位还需要 N 颗星，而空位恰好只剩 N 个时——这些空位就是星。双击放星。'),
    SETUP_STEP('lv4-setup', '先用前面学过的规则推进，留意哪个单位的空位已经很少了。', ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated']),
    GUIDED_STEP('lv4-guided', 'guided',
      '看这个单位：还需要的星数恰好等于剩余空位数。这些位置就是星！双击放星。',
      'remaining-capacity', 'place-star', [
        { copy: '先数一数这个单位已经放了几颗星。' },
        { copy: '需星数等于剩余空位数时，空位就是星。' },
        { copy: '双击高亮格放星。' },
      ]),
    PRACTICE_STEP('lv4-practice',
      '自己找一个"空位数等于缺星数"的单位，把星确定下来。',
      'remaining-capacity', 'place-star', [
        { copy: '扫描每个单位的星数和空位数。' },
      ]),
    ...AUTONOMOUS('剩余棋盘由你完成。记住：空位数等于缺星数时，直接放星。'),
  ],
  summaryCopy: '剩余空位恰好等于还缺的星数时，它们就是星位。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: { actualTopicRequired: true, distinctFromLv3: true },
});

// ═══ Lv.5: 寻找第二颗 (STRATEGY) ═══

const LV5 = deepFreeze({
  levelId: 'star-double-tutorial-05', lessonNumber: 5,
  topic: '已有一颗，寻找第二颗',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'FIND_SECOND_STAR',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: [
    ...INTRO_WAIT('不必同时找两颗星。某个单位已经有 1 颗星后，集中精力用其他规则锁定第二颗。'),
    SETUP_STEP('lv5-setup', '用前面学过的规则推进棋盘。当某个单位确认了 1 颗星后，想想第二颗在哪。', ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity']),
    GUIDED_STEP('lv5-guided', 'guided',
      '这个单位已经有 1 颗星，还需要第 2 颗。结合 2×2 和相邻规则锁定它。',
      'remaining-capacity', 'place-star', [
        { copy: '确认这个单位的第一颗星在哪。' },
        { copy: '排除已放星周围和已满单位后，剩余空位中找第二颗。' },
      ]),
    PRACTICE_STEP('lv5-practice',
      '找另一个已有 1 颗星的不同类别单位，锁定它的第二颗。',
      'remaining-capacity', 'place-star', [
        { copy: '扫描哪些行、列或星域已经有 1 颗星。' },
      ]),
    ...AUTONOMOUS('接下来逐颗推进完成棋盘。'),
  ],
  summaryCopy: '不必同时找齐两颗星——确认一颗后再找第二颗，推理更有条理。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: { secondStarStrategyExercised: true },
});

// ═══ Lv.6: 区域形状 (RULE) ═══

const LV6 = deepFreeze({
  levelId: 'star-double-tutorial-06', lessonNumber: 6,
  topic: '区域形状锁定',
  courseType: COURSE_TYPE.RULE,
  newRule: 'confined-capacity',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: [
    ...INTRO_WAIT('星域的形状本身就是线索——窄长的区域会把星限制在少数几个位置。观察 2×2 块在这些区域里的分布。'),
    GUIDED_STEP('lv6-guided', 'guided',
      '看这个窄星域：它的 2×2 块覆盖情况限制了什么？排除被 2×2 覆盖但不在区域候选内的空格。',
      'two-by-two-capacity', 'eliminate', [
        { copy: '先观察棋盘中最窄的那个星域的形状。' },
        { copy: '窄区域只跨越有限的 2×2 块——每个 2×2 最多 1 星。' },
        { copy: '排除形状限制以外的空位。' },
      ]),
    PRACTICE_STEP('lv6-practice',
      '找另一个受形状影响的星域，结合 2×2 规则自己排除不可能的位置。',
      'two-by-two-capacity', 'eliminate', [
        { copy: '棋盘里还有别的窄区域——它的形状决定了 2×2 覆盖方式。' },
      ]),
    ...AUTONOMOUS('接下来自己完成。每次不确定时先观察星域形状。'),
  ],
  summaryCopy: '星域的形状本身就是线索——窄长的区域结合 2×2 限制，能排除很多位置。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: { actualTopicRequired: true },
});

// ═══ Lv.7: 交叉推理 (RULE) ═══

const LV7 = deepFreeze({
  levelId: 'star-double-tutorial-07', lessonNumber: 7,
  topic: '行列与星域交叉',
  courseType: COURSE_TYPE.RULE,
  newRule: 'cross-unit-confinement',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: [
    ...INTRO_WAIT('单独看一行或一列线索不够时，把行、列和星域交叉起来看——2×2 块在交叉处的分布会揭示隐藏的排除。'),
    GUIDED_STEP('lv7-guided', 'guided',
      '同时看这一行和这个星域的重合区域：2×2 块在重合处怎么分布？排除被覆盖但不在候选内的空格。',
      'two-by-two-capacity', 'eliminate', [
        { copy: '先单独看这一行上的 2×2 块分布。' },
        { copy: '再看这个星域与这行重合处的 2×2 覆盖——二者结合给出更强的限制。' },
        { copy: '排除被联合覆盖范围外的空位。' },
      ]),
    PRACTICE_STEP('lv7-practice',
      '自己选一列和一个星域，交叉观察它们的 2×2 覆盖。',
      'two-by-two-capacity', 'eliminate', [
        { copy: '找一列和一个星域——观察交叉处的 2×2 块。' },
      ]),
    ...AUTONOMOUS('接下来自己完成。做每个判断前扫一眼相关的行、列和星域。'),
  ],
  summaryCopy: '把行、列和星域交叉起来观察 2×2 块分布，线索会更清楚。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: { actualTopicRequired: true, crossUnitRequired: true },
});

// ═══ Lv.8: 必有一星 (RULE) ═══

const LV8 = deepFreeze({
  levelId: 'star-double-tutorial-08', lessonNumber: 8,
  topic: '两个位置必有一星',
  courseType: COURSE_TYPE.RULE,
  newRule: 'shared-conflict-exclusion',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity'],
  steps: [
    ...INTRO_WAIT('两个位置中必定有一颗星时，与这两个位置都冲突的格子可以排除。'),
    GUIDED_STEP('lv8-guided', 'guided',
      '看这个区域：只剩两个空位，2×2 和相邻规则迫使必有一星。与两者都相邻的格子一定不是星——排除它。',
      'adjacency-exclusion', 'eliminate', [
        { copy: '先找只剩少量空位的单位——那是"必有一星"出现的地方。' },
        { copy: '两个位置候选且都与某格相邻——该格一定不能放星。' },
        { copy: '排除与这两个位置都冲突的空格。' },
      ]),
    PRACTICE_STEP('lv8-practice',
      '自己找另一组"两个位置必有一星"的情况，排除与两者都冲突的格子。',
      'adjacency-exclusion', 'eliminate', [
        { copy: '哪些行、列或星域只剩两个空位？' },
      ]),
    ...AUTONOMOUS('善用"两个位置必有一星"能排除很多隐藏的冲突格。'),
  ],
  summaryCopy: '两个位置中必有一星时，与两者都冲突的位置就可以排除。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity'],
  gates: { actualTopicRequired: true, evidenceTargetSeparation: true },
});

// ═══ Lv.9: 连续传播 (STRATEGY) ═══

const LV9 = deepFreeze({
  levelId: 'star-double-tutorial-09', lessonNumber: 9,
  topic: '连续传播',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'PROPAGATION_CHAIN',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity', 'cross-unit-confinement', 'shared-conflict-exclusion'],
  steps: [
    ...INTRO_WAIT('每做完一步推理，马上扫描它影响的行、列和星域——一个结论会触发下一个。这就是传播链。'),
    {
      id: 'lv9-chain1', type: 'guided', phase: 'guided', chainStep: 1,
      copy: '先用已学规则做第一步推理。做完后：不要马上继续，先扫描这步影响了哪些单位。',
      technique: null, expectedAction: null,
      hintTiers: [{ copy: '从一角开始，用你最熟悉的规则做第一次排除或放星。' }],
    },
    {
      id: 'lv9-chain2', type: 'guided', phase: 'guided', chainStep: 2, dependsOnChain: 1,
      copy: '上一步让某个单位发生了变化——空位更少了。这一步能推出什么？',
      technique: null, expectedAction: null,
      hintTiers: [{ copy: '扫描上一步影响的单位：空位数变了吗？星数变了吗？' }],
    },
    {
      id: 'lv9-chain3', type: 'guided', phase: 'guided', chainStep: 3, dependsOnChain: 2,
      copy: '第二步的结果又影响了新的单位——继续扫描。这就是传播链的第三步。',
      technique: null, expectedAction: null,
      hintTiers: [{ copy: '扫描第二步影响了哪些行、列、星域？' }],
    },
    ...AUTONOMOUS('你已经体验了三步传播链。用这个习惯完成剩余棋盘。'),
  ],
  summaryCopy: '每得到一个结论，都重新扫描相邻的行、列和星域——传播链是双星最重要的技巧。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: { propagationChainLength: 3, chainDependencyRequired: true },
});

// ═══ Lv.10: 毕业关 ═══

const LV10 = deepFreeze({
  levelId: 'star-double-tutorial-10', lessonNumber: 10,
  topic: '基础逻辑综合',
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'GRADUATION',
  prerequisiteRules: ['two-by-two-capacity', 'adjacency-exclusion', 'quota-saturated', 'remaining-capacity', 'confined-capacity', 'cross-unit-confinement', 'shared-conflict-exclusion', 'propagation-chain'],
  steps: [
    ...INTRO_WAIT('你已经学完双星的全部基础逻辑和策略。这一关请独立完成——卡住时可以使用提示。', '开始挑战'),
    ...AUTONOMOUS('独立完成整关。10 秒后可逐级查看提示。'),
  ],
  summaryCopy: '你已经能独立组合双星的基础逻辑。',
  allowedRules: ['remaining-capacity', 'quota-saturated', 'adjacency-exclusion', 'two-by-two-capacity', 'confined-capacity'],
  gates: { noNewTechnique: true },
});

// ═══ Registry ═══

export const STAR_DOUBLE_LESSON_CONTRACTS = deepFreeze({
  'star-double-tutorial-01': STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
  'star-double-tutorial-02': LV2,
  'star-double-tutorial-03': LV3,
  'star-double-tutorial-04': LV4,
  'star-double-tutorial-05': LV5,
  'star-double-tutorial-06': LV6,
  'star-double-tutorial-07': LV7,
  'star-double-tutorial-08': LV8,
  'star-double-tutorial-09': LV9,
  'star-double-tutorial-10': LV10,
});

export function getStarDoubleLessonContract(levelId) {
  return STAR_DOUBLE_LESSON_CONTRACTS[levelId] || null;
}

export function isStarDoubleTeachingLevel(levelId) {
  return levelId in STAR_DOUBLE_LESSON_CONTRACTS;
}

export function validateContractNoStaticAnswers(levelId) {
  if (levelId === 'star-double-tutorial-01') return [];
  const contract = STAR_DOUBLE_LESSON_CONTRACTS[levelId];
  if (!contract) return ['contract not found'];
  const violations = [];
  for (const step of (contract.steps || [])) {
    for (const field of ['actionCells', 'targetCells', 'solutionCells', 'expectedCellIndexes']) {
      if (step[field] !== undefined) violations.push(`step ${step.id}: forbidden "${field}"`);
    }
  }
  return violations;
}
