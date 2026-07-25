/**
 * Star Double Lv.2–10 lesson contracts.
 *
 * Contracts describe learning goals and proof selection policy. They never
 * contain board coordinates, answer cells or solution data. Lv.1 continues to
 * use its already-approved legacy contract by reference.
 */
import { STAR_LINE_DOUBLE_TUTORIAL_CONTRACT } from './starLineDoubleTutorialContract.js';
import { STAR_DOUBLE_PROOF_TECHNIQUE as T } from './starLineDoubleLessonEngine.js';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const COURSE_TYPE = Object.freeze({
  RULE: 'rule',
  EQUIVALENT_CONCEPT: 'equivalent-concept',
  STRATEGY: 'strategy',
});

export const LESSON_PHASE = Object.freeze({
  INTRO: 'intro',
  SETUP: 'setup',
  GUIDED: 'guided',
  TRANSFER_PRACTICE: 'transfer-practice',
  AUTONOMOUS: 'autonomous',
  SUMMARY: 'summary',
});

const ERROR_FEEDBACK = deepFreeze({
  missingProof: '当前局面没有符合本课目标的推理，请重新开始本关。',
  staleProof: '棋盘已经变化，请根据新的高亮线索重新判断。',
  wrongCell: '这个位置不能由当前高亮线索推出。',
  wrongAction: '操作类型不对，请按提示标 X 或放星。',
});

function passiveStep({ id, type, phase, topic, copy, buttonLabel = null, completionType }) {
  return deepFreeze({
    id,
    type,
    phase,
    lessonTopic: topic,
    proofSelector: null,
    allowedPrerequisiteRules: [],
    completionPredicate: { type: completionType },
    expectedAction: null,
    actionCopy: copy,
    copy,
    observationPresentation: 'none',
    evidencePresentation: 'none',
    targetVisibility: 'hidden',
    errorFeedback: ERROR_FEEDBACK,
    transitionCondition: completionType,
    ...(buttonLabel ? { buttonLabel } : {}),
  });
}

function intro(topic, copy, buttonLabel = '开始') {
  return passiveStep({
    id: 'intro',
    type: 'explain',
    phase: LESSON_PHASE.INTRO,
    topic,
    copy,
    buttonLabel,
    completionType: 'manual-confirmation',
  });
}

function interactiveStep({
  id,
  type,
  phase,
  topic,
  copy,
  selector,
  prerequisites = [],
  completion,
  expectedAction = 'dynamic',
  observation = 'highlight',
  evidence = 'highlight',
}) {
  return deepFreeze({
    id,
    type,
    phase,
    lessonTopic: topic,
    proofSelector: selector,
    allowedPrerequisiteRules: prerequisites,
    completionPredicate: completion,
    expectedAction,
    actionCopy: copy,
    copy,
    observationPresentation: observation,
    evidencePresentation: evidence,
    targetVisibility: 'hidden',
    errorFeedback: ERROR_FEEDBACK,
    transitionCondition: 'completion-predicate-met',
  });
}

function setup({ id, topic, copy, prerequisites, completion, selector = null }) {
  return interactiveStep({
    id,
    type: 'setup',
    phase: LESSON_PHASE.SETUP,
    topic,
    copy,
    selector: selector || {
      techniques: prerequisites,
      preferActions: ['place-star', 'eliminate'],
    },
    prerequisites,
    completion,
  });
}

function guided({ id, topic, copy, technique, action, completion, selector = {} }) {
  return interactiveStep({
    id,
    type: 'guided',
    phase: LESSON_PHASE.GUIDED,
    topic,
    copy,
    selector: {
      techniques: [technique],
      actions: [action],
      ...selector,
    },
    completion,
    expectedAction: action,
  });
}

function practice({ id, topic, copy, technique, action, completion, selector = {} }) {
  return interactiveStep({
    id,
    type: 'practice',
    phase: LESSON_PHASE.TRANSFER_PRACTICE,
    topic,
    copy,
    selector: {
      techniques: [technique],
      actions: [action],
      excludeCompletedObjectives: true,
      ...selector,
    },
    completion,
    expectedAction: action,
  });
}

function autonomous(topic, copy) {
  return passiveStep({
    id: 'autonomous',
    type: 'autonomous',
    phase: LESSON_PHASE.AUTONOMOUS,
    topic,
    copy,
    completionType: 'board-complete',
  });
}

function summary(topic, copy) {
  return passiveStep({
    id: 'summary',
    type: 'summary',
    phase: LESSON_PHASE.SUMMARY,
    topic,
    copy,
    completionType: 'lesson-complete',
  });
}

const LV2_TOPIC = '星星周围八格排除';
const LV2 = deepFreeze({
  levelId: 'star-double-tutorial-02',
  lessonNumber: 2,
  topic: LV2_TOPIC,
  courseType: COURSE_TYPE.EQUIVALENT_CONCEPT,
  newRule: T.ADJACENCY_EXCLUSION,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY],
  steps: [
    intro(LV2_TOPIC, '放下一颗星后，它的上、下、左、右和四个斜角都不能再放星。本关要亲手排除完整八邻格。'),
    setup({
      id: 'lv2-setup',
      topic: LV2_TOPIC,
      copy: '先用 2×2 容量线索确定一颗星。根据高亮线索，在确定的位置放置星星。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY],
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY],
        actions: ['place-star'],
        requireInteriorTarget: true,
      },
      completion: { type: 'star-count-at-least', count: 1 },
    }),
    guided({
      id: 'lv2-guided',
      topic: LV2_TOPIC,
      copy: '观察这颗星和它周围的八个方向。根据高亮线索，把不能放星的位置标成 X。',
      technique: T.ADJACENCY_EXCLUSION,
      action: 'eliminate',
      selector: { requireFullEightNeighbors: true },
      completion: { type: 'all-eight-neighbors-eliminated' },
    }),
    practice({
      id: 'lv2-transfer-star',
      topic: LV2_TOPIC,
      copy: '先在另一处用已学规则确定一颗星。根据高亮线索，在确定的位置放置星星。',
      technique: T.TWO_BY_TWO_CAPACITY,
      action: 'place-star',
      completion: { type: 'proof-targets-resolved' },
      selector: { excludeCompletedObjectives: true, requireInteriorTarget: true },
    }),
    practice({
      id: 'lv2-practice',
      topic: LV2_TOPIC,
      copy: '观察另一颗星，自己判断它周围哪些位置不能放星并标成 X；目标位置不会显示。',
      technique: T.ADJACENCY_EXCLUSION,
      action: 'eliminate',
      completion: { type: 'all-neighbors-eliminated' },
      selector: { excludeCompletedObjectives: true },
    }),
    autonomous(LV2_TOPIC, '继续独立完成棋盘。每放一颗星，都检查它周围的八个方向。'),
    summary(LV2_TOPIC, '一颗星会排除周围八格：上下左右和四个斜角都不能再放星。'),
  ],
  summaryCopy: '一颗星会排除周围八格：上下左右和四个斜角都不能再放星。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  gates: { fullNeighborCoverage: true, equivalentProofAllowed: true },
});

const LV3_TOPIC = '单位放满两颗星后的排除';
const LV3 = deepFreeze({
  levelId: 'star-double-tutorial-03',
  lessonNumber: 3,
  topic: LV3_TOPIC,
  courseType: COURSE_TYPE.RULE,
  newRule: T.QUOTA_SATURATED,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION],
  steps: [
    intro(LV3_TOPIC, '当一行、一列或一个星域已经有两颗星，其余位置都不能再放星。'),
    setup({
      id: 'lv3-setup',
      topic: LV3_TOPIC,
      copy: '先用已学规则放下两颗能够确定的星，留意哪个单位已经满足双星配额。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION],
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION],
        preferActions: ['place-star', 'eliminate'],
        requireInteriorTarget: true,
      },
      completion: { type: 'saturated-unit-exists' },
    }),
    guided({
      id: 'lv3-guided',
      topic: LV3_TOPIC,
      copy: '这个单位已经有两颗星。根据高亮线索，把其余不能放星的位置标成 X。',
      technique: T.QUOTA_SATURATED,
      action: 'eliminate',
      completion: { type: 'unit-cleared' },
    }),
    practice({
      id: 'lv3-transfer-star-a',
      topic: LV3_TOPIC,
      copy: '在另一处用 2×2 容量线索确定第一颗星，为下一次满额排除准备局面。',
      technique: T.TWO_BY_TWO_CAPACITY,
      action: 'place-star',
      completion: { type: 'proof-targets-resolved' },
    }),
    practice({
      id: 'lv3-transfer-star-b',
      topic: LV3_TOPIC,
      copy: '继续用 2×2 容量线索确定同一行或列的第二颗星。',
      technique: T.TWO_BY_TWO_CAPACITY,
      action: 'place-star',
      completion: { type: 'proof-targets-resolved' },
    }),
    practice({
      id: 'lv3-practice',
      topic: LV3_TOPIC,
      copy: '自己找另一处已经放满两颗星的行、列或星域，把剩余位置标成 X。',
      technique: T.QUOTA_SATURATED,
      action: 'eliminate',
      completion: { type: 'unit-cleared' },
      selector: { preferDifferentUnitKind: true },
    }),
    autonomous(LV3_TOPIC, '继续独立完成棋盘。每次放星后都检查相关单位是否已经满额。'),
    summary(LV3_TOPIC, '一行、一列或一个星域放满两颗星后，其余位置全部排除。'),
  ],
  summaryCopy: '一行、一列或一个星域放满两颗星后，其余位置全部排除。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  gates: { actualTopicRequired: true },
});

const LV4_TOPIC = '剩余位置刚好等于还缺的星数';
const LV4 = deepFreeze({
  levelId: 'star-double-tutorial-04',
  lessonNumber: 4,
  topic: LV4_TOPIC,
  courseType: COURSE_TYPE.RULE,
  newRule: T.REMAINING_CAPACITY,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
  steps: [
    intro(LV4_TOPIC, '如果一个单位还缺的星数，正好等于它剩余的合法位置数，这些位置就确定是星。'),
    setup({
      id: 'lv4-setup',
      topic: LV4_TOPIC,
      copy: '先用之前的规则推进，直到某个单位的合法位置刚好够放完还缺的星。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
        preferActions: ['place-star', 'eliminate'],
        requireInteriorTarget: true,
      },
      completion: { type: 'forced-star-unit-ready' },
    }),
    guided({
      id: 'lv4-guided',
      topic: LV4_TOPIC,
      copy: '这个单位还缺的星数等于剩余合法位置数。根据高亮线索，在确定的位置放置星星。',
      technique: T.REMAINING_CAPACITY,
      action: 'place-star',
      completion: { type: 'unit-quota-filled' },
    }),
    interactiveStep({
      id: 'lv4-transfer-setup',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV4_TOPIC,
      copy: '用之前的排除规则继续推进，直到另一个单位的合法位置刚好够用。',
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
        preferActions: ['place-star', 'eliminate'],
      },
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
      completion: { type: 'forced-star-unit-ready' },
    }),
    practice({
      id: 'lv4-practice',
      topic: LV4_TOPIC,
      copy: '自己找另一个“剩余位置刚好够用”的单位并放星；目标位置不会显示。',
      technique: T.REMAINING_CAPACITY,
      action: 'place-star',
      completion: { type: 'unit-quota-filled' },
      selector: { preferDifferentUnitKind: true },
    }),
    autonomous(LV4_TOPIC, '继续独立完成棋盘。分清“配额已满所以排除”和“位置刚好所以放星”。'),
    summary(LV4_TOPIC, '剩余合法位置数等于还缺的星数时，这些位置全部是星。'),
  ],
  summaryCopy: '剩余合法位置数等于还缺的星数时，这些位置全部是星。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  gates: { actualTopicRequired: true, distinctFromLv3: true },
});

const LV5_TOPIC = '先有一颗，再寻找第二颗';
const LV5 = deepFreeze({
  levelId: 'star-double-tutorial-05',
  lessonNumber: 5,
  topic: LV5_TOPIC,
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'FIND_SECOND_STAR',
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  steps: [
    intro(LV5_TOPIC, '一个单位已经确定一颗星后，不必同时考虑两颗；结合相邻、配额和容量线索寻找第二颗。'),
    setup({
      id: 'lv5-setup',
      topic: LV5_TOPIC,
      copy: '先确定一颗星，并观察它同时影响的行、列和星域。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
        preferActions: ['place-star', 'eliminate'],
        requireInteriorTarget: true,
      },
      completion: { type: 'second-star-proof-ready' },
    }),
    guided({
      id: 'lv5-guided',
      topic: LV5_TOPIC,
      copy: '这个单位已有一颗星。结合高亮的相邻排除和单位容量，在确定的位置放下第二颗星。',
      technique: T.REMAINING_CAPACITY,
      action: 'place-star',
      selector: { requireExistingStarCount: 1, requireSupportingRuleCount: 2 },
      completion: { type: 'second-star-placed' },
    }),
    interactiveStep({
      id: 'lv5-transfer-setup',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV5_TOPIC,
      copy: '先用排除规则在不同类别的单位中确认一颗星，为寻找另一颗做准备。',
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
        preferActions: ['place-star', 'eliminate'],
      },
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED],
      completion: { type: 'second-star-proof-ready' },
    }),
    practice({
      id: 'lv5-practice',
      topic: LV5_TOPIC,
      copy: '换一个不同类别的单位，自己结合至少两类已学规则找出第二颗星。',
      technique: T.REMAINING_CAPACITY,
      action: 'place-star',
      selector: {
        requireExistingStarCount: 1,
        requireSupportingRuleCount: 2,
        preferDifferentUnitKind: true,
      },
      completion: { type: 'second-star-placed' },
    }),
    autonomous(LV5_TOPIC, '继续独立完成棋盘。先确认一颗，再围绕它寻找第二颗。'),
    summary(LV5_TOPIC, '已有一颗星时，把问题缩小为“第二颗在哪里”，再组合相邻与容量线索。'),
  ],
  summaryCopy: '已有一颗星时，把问题缩小为“第二颗在哪里”，再组合相邻与容量线索。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  gates: { secondStarStrategyExercised: true },
});

const LV6_TOPIC = '星域形状与局部容量';
const LV6 = deepFreeze({
  levelId: 'star-double-tutorial-06',
  lessonNumber: 6,
  topic: LV6_TOPIC,
  courseType: COURSE_TYPE.RULE,
  newRule: T.CONFINED_CAPACITY,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
  steps: [
    intro(LV6_TOPIC, '窄长或转折的星域会把两颗星限制在局部；比较星域与行列的容量，就能排除外部位置。'),
    setup({
      id: 'lv6-setup',
      topic: LV6_TOPIC,
      copy: '先做少量基础推理，让一个星域的候选位置收窄。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
      completion: { type: 'confined-capacity-ready' },
    }),
    guided({
      id: 'lv6-guided',
      topic: LV6_TOPIC,
      copy: '观察窄星域和它占用的行或列。根据高亮线索，把容量之外的位置标成 X。',
      technique: T.CONFINED_CAPACITY,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
    }),
    interactiveStep({
      id: 'lv6-transfer-setup',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV6_TOPIC,
      copy: '先用已学规则继续推进，直到另一处星域形状形成新的容量限制。',
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
        preferActions: ['place-star', 'eliminate'],
      },
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY],
      completion: { type: 'confined-capacity-ready' },
    }),
    practice({
      id: 'lv6-practice',
      topic: LV6_TOPIC,
      copy: '换一个受形状限制的星域，自己比较局部容量并排除外部位置。',
      technique: T.CONFINED_CAPACITY,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
    }),
    autonomous(LV6_TOPIC, '继续独立完成。卡住时先看星域形状是否把星限制在少数行列中。'),
    summary(LV6_TOPIC, '星域形状会限制两颗星占用的行列；容量被占满后，外部位置即可排除。'),
  ],
  summaryCopy: '星域形状会限制两颗星占用的行列；容量被占满后，外部位置即可排除。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY],
  gates: { actualTopicRequired: true },
});

const LV7_TOPIC = '两个单位交叉判断';
const LV7 = deepFreeze({
  levelId: 'star-double-tutorial-07',
  lessonNumber: 7,
  topic: LV7_TOPIC,
  courseType: COURSE_TYPE.RULE,
  newRule: T.MULTI_UNIT_INTERSECTION,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY],
  steps: [
    intro(LV7_TOPIC, '单看一个单位还不够时，把两行、两列或两个星域的容量与另一类单位交叉比较。'),
    setup({
      id: 'lv7-setup',
      topic: LV7_TOPIC,
      copy: '先用一个已学结论推进棋盘，让两组单位形成可以交叉比较的新局面。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY],
      completion: { type: 'multi-unit-intersection-ready' },
    }),
    guided({
      id: 'lv7-guided',
      topic: LV7_TOPIC,
      copy: '同时观察两组高亮单位。单看其中一个不能下结论；合并容量后，把外部位置标成 X。',
      technique: T.MULTI_UNIT_INTERSECTION,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
      selector: { requireMultipleSourceUnits: true },
    }),
    interactiveStep({
      id: 'lv7-transfer-setup',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV7_TOPIC,
      copy: '用已学规则推进受影响的区域，直到出现另一组可以交叉比较的单位。',
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY],
        preferActions: ['place-star', 'eliminate'],
      },
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY],
      completion: { type: 'multi-unit-intersection-ready' },
    }),
    practice({
      id: 'lv7-practice',
      topic: LV7_TOPIC,
      copy: '自己找另一组交叉单位完成同类判断；只显示观察范围和依据，不显示目标。',
      technique: T.MULTI_UNIT_INTERSECTION,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
      selector: { requireMultipleSourceUnits: true },
    }),
    autonomous(LV7_TOPIC, '继续独立完成。单个单位没结论时，尝试把两个单位合并比较。'),
    summary(LV7_TOPIC, '把两个单位的候选位置与另一类单位交叉比较，可以得到单看一处得不到的排除。'),
  ],
  summaryCopy: '把两个单位的候选位置与另一类单位交叉比较，可以得到单看一处得不到的排除。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION],
  gates: { actualTopicRequired: true, crossUnitRequired: true },
});

const LV8_TOPIC = '两个依据位置的共同冲突';
const LV8 = deepFreeze({
  levelId: 'star-double-tutorial-08',
  lessonNumber: 8,
  topic: LV8_TOPIC,
  courseType: COURSE_TYPE.RULE,
  newRule: T.COMMON_CONFLICT,
  prerequisiteRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION],
  steps: [
    intro(LV8_TOPIC, '当两个候选位置中必有一颗星，同时与两者冲突的位置就一定不能放星。'),
    setup({
      id: 'lv8-setup',
      topic: LV8_TOPIC,
      copy: '先用少量已学规则，让某个单位出现一组“其中必有一星”的两个候选位置。',
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION],
      completion: { type: 'common-conflict-ready' },
    }),
    guided({
      id: 'lv8-guided',
      topic: LV8_TOPIC,
      copy: '亮色依据格中必有一星；观察与两者都冲突的范围，把不能放星的位置标成 X。',
      technique: T.COMMON_CONFLICT,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
      selector: { requireEvidencePair: true },
    }),
    interactiveStep({
      id: 'lv8-transfer-setup',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV8_TOPIC,
      copy: '用已学规则继续推进，直到另一组“两个位置中必有一星”的依据出现。',
      selector: {
        techniques: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION],
        preferActions: ['place-star', 'eliminate'],
      },
      prerequisites: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION],
      completion: { type: 'common-conflict-ready' },
    }),
    practice({
      id: 'lv8-practice',
      topic: LV8_TOPIC,
      copy: '自己找另一对“其中必有一星”的位置，并排除与两者都冲突的格子。',
      technique: T.COMMON_CONFLICT,
      action: 'eliminate',
      completion: { type: 'proof-targets-resolved' },
      selector: { requireEvidencePair: true },
    }),
    autonomous(LV8_TOPIC, '继续独立完成。看到两个位置必有一星时，检查它们的共同冲突位置。'),
    summary(LV8_TOPIC, '两个依据位置中必有一星时，与两者都冲突的位置可以排除。'),
  ],
  summaryCopy: '两个依据位置中必有一星时，与两者都冲突的位置可以排除。',
  allowedRules: [T.TWO_BY_TWO_CAPACITY, T.ADJACENCY_EXCLUSION, T.QUOTA_SATURATED, T.REMAINING_CAPACITY, T.CONFINED_CAPACITY, T.MULTI_UNIT_INTERSECTION, T.COMMON_CONFLICT],
  gates: { actualTopicRequired: true, evidenceTargetSeparation: true },
});

const LV9_TOPIC = '一步推动下一步的传播链';
const LV9 = deepFreeze({
  levelId: 'star-double-tutorial-09',
  lessonNumber: 9,
  topic: LV9_TOPIC,
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'PROPAGATION_CHAIN',
  prerequisiteRules: Object.values(T),
  steps: [
    intro(LV9_TOPIC, '每得到一个结论，马上重新扫描它影响的行、列和星域；新的局面会产生下一步。'),
    interactiveStep({
      id: 'lv9-chain1',
      type: 'guided',
      phase: LESSON_PHASE.GUIDED,
      topic: LV9_TOPIC,
      copy: '根据当前高亮线索完成第一步。完成后，观察它改变了哪些单位。',
      selector: {
        techniques: Object.values(T),
        preferActions: ['place-star', 'eliminate'],
        requiresNextConclusion: true,
        singleConclusion: true,
      },
      completion: { type: 'dependent-conclusion-applied', chainStep: 1 },
    }),
    interactiveStep({
      id: 'lv9-chain2',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV9_TOPIC,
      copy: '第一步产生了新的线索。根据受影响的单位完成第二步。',
      selector: {
        techniques: Object.values(T),
        dependsOnPreviousConclusion: true,
        requiresNextConclusion: true,
        singleConclusion: true,
      },
      completion: { type: 'dependent-conclusion-applied', chainStep: 2 },
    }),
    interactiveStep({
      id: 'lv9-chain3',
      type: 'practice',
      phase: LESSON_PHASE.TRANSFER_PRACTICE,
      topic: LV9_TOPIC,
      copy: '第二步又产生了新的线索。继续扫描受影响单位，完成第三步。',
      selector: { techniques: Object.values(T), dependsOnPreviousConclusion: true, singleConclusion: true },
      completion: { type: 'dependent-conclusion-applied', chainStep: 3 },
    }),
    autonomous(LV9_TOPIC, '继续独立完成。每次操作后都重新扫描相关的行、列和星域。'),
    summary(LV9_TOPIC, '传播链不是新规则，而是“每个结论后重新扫描”的解题习惯。'),
  ],
  summaryCopy: '传播链不是新规则，而是“每个结论后重新扫描”的解题习惯。',
  allowedRules: Object.values(T),
  gates: { propagationChainLength: 3, chainDependencyRequired: true },
});

const LV10_TOPIC = '双星基础课程毕业挑战';
const LV10 = deepFreeze({
  levelId: 'star-double-tutorial-10',
  lessonNumber: 10,
  topic: LV10_TOPIC,
  courseType: COURSE_TYPE.STRATEGY,
  strategyPattern: 'GRADUATION',
  prerequisiteRules: Object.values(T),
  steps: [
    intro(LV10_TOPIC, '你已经学完双星基础逻辑。这一关不增加新规则，请独立完成。', '开始挑战'),
    autonomous(LV10_TOPIC, '独立完成整关。卡住时可以在 10 秒后逐级查看基础提示。'),
    summary(LV10_TOPIC, '你已经能组合双星的基础逻辑，独立完成完整棋盘。'),
  ],
  summaryCopy: '你已经能组合双星的基础逻辑，独立完成完整棋盘。',
  allowedRules: Object.values(T),
  gates: { noNewTechnique: true },
});

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
  const forbiddenFields = [
    'actionCells',
    'targetCells',
    'solutionCells',
    'expectedCellIndexes',
    'pointerCells',
    'observationCells',
    'evidenceCells',
  ];
  const violations = [];
  for (const step of contract.steps || []) {
    for (const field of forbiddenFields) {
      if (step[field] !== undefined) violations.push(`step ${step.id}: forbidden "${field}"`);
    }
  }
  return violations;
}
