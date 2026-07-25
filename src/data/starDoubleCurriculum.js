export const STAR_DOUBLE_CURRICULUM_VERSION = 'star-double-curriculum-2.0.0';

export const STAR_DOUBLE_SIZE_RANGES = Object.freeze([
  Object.freeze({ boardSize: 8, startSlot: 1, endSlot: 30 }),
  Object.freeze({ boardSize: 9, startSlot: 31, endSlot: 50 }),
  Object.freeze({ boardSize: 10, startSlot: 51, endSlot: 60 }),
]);

const TUTORIAL_FOCUS = Object.freeze([
  '认识双星规则', '星星周围排除', '配额已经满足', '剩余位置等于剩余星数',
  '已有一颗，寻找第二颗', '区域形状锁定', '行列与星域交叉', '两个位置必有一星',
  '连续传播', '基础逻辑毕业关',
]);

export const STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE = Object.freeze([
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 9, firstStarDepth: 4, forcedMoveRatio: 0.556, longestPropagationChain: 9, crossUnitReasoningCount: 0, independentBeforeHintRatio: 0.875, difficultyScore: 65.4, changeReason: '基准课；完整引导只揭示八邻格操作，其余结论仍由玩家完成。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 6, firstStarDepth: 3, forcedMoveRatio: 0.5, longestPropagationChain: 6, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 65.7, changeReason: '取消答案揭示；玩家先完成一次真实放星，再亲手排除完整八邻格。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 5, firstStarDepth: 2, forcedMoveRatio: 0.6, longestPropagationChain: 5, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 66.8, changeReason: '两次真实前置放星形成满额单位，随后由玩家完成配额排除。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 6, firstStarDepth: 3, forcedMoveRatio: 0.5, longestPropagationChain: 6, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 77.7, changeReason: '进入独立基础推理阶段；玩家亲自完成剩余容量放星与迁移练习。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 7, firstStarDepth: 3, forcedMoveRatio: 0.571, longestPropagationChain: 7, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 81.3, changeReason: '传播增加一波，并要求结合已学依据寻找同一单位的第二颗星。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 34, CONFINED_CAPACITY: 14, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 10, firstStarDepth: 5, forcedMoveRatio: 0.5, longestPropagationChain: 10, crossUnitReasoningCount: 14, independentBeforeHintRatio: 1, difficultyScore: 91.3, changeReason: '首次加入区域形状限制，出现十四次跨单位推理并形成十波链。' },
  { actualTechniqueCounts: { CONFINED_CAPACITY: 18, TWO_BY_TWO_CAPACITY: 28, MULTI_UNIT_CONFINEMENT: 2, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 4, forcedMoveRatio: 0.5, longestPropagationChain: 8, crossUnitReasoningCount: 20, independentBeforeHintRatio: 1, difficultyScore: 99.1, changeReason: '进入联动阶段；两次多单位交叉结论均由玩家在真实盘面中完成。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 18, MULTI_UNIT_CONFINEMENT: 6, PRESSURED_GROUP_EXCLUSION: 10, ADJACENCY_EXCLUSION: 3, CONFINED_CAPACITY: 13, REMAINING_CAPACITY: 8, QUOTA_SATURATED: 6 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 3, forcedMoveRatio: 0.5, longestPropagationChain: 8, crossUnitReasoningCount: 29, independentBeforeHintRatio: 1, difficultyScore: 103.5, changeReason: '加入两位置共同排除，跨单位推理增至二十九次。' },
  { actualTechniqueCounts: { CONFINED_CAPACITY: 18, TWO_BY_TWO_CAPACITY: 18, MULTI_UNIT_CONFINEMENT: 4, PRESSURED_GROUP_EXCLUSION: 11, QUOTA_SATURATED: 7, ADJACENCY_EXCLUSION: 1, REMAINING_CAPACITY: 5 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 0, forcedMoveRatio: 0.75, longestPropagationChain: 8, crossUnitReasoningCount: 33, independentBeforeHintRatio: 1, difficultyScore: 104.8, changeReason: '不新增规则；玩家连续执行三条前后依赖的证明，再进入完整自主解题。' },
  { actualTechniqueCounts: { MULTI_UNIT_CONFINEMENT: 4, TWO_BY_TWO_CAPACITY: 36, PRESSURED_GROUP_EXCLUSION: 6, ADJACENCY_EXCLUSION: 1, REMAINING_CAPACITY: 10, QUOTA_SATURATED: 5, CONFINED_CAPACITY: 2 }, humanTraceLength: 64, deductionWaveCount: 10, firstStarDepth: 1, forcedMoveRatio: 0.6, longestPropagationChain: 10, crossUnitReasoningCount: 12, independentBeforeHintRatio: 1, difficultyScore: 105.8, changeReason: '不新增规则；以十波完整链综合复用前九课知识，并保持低于 Lv.11。' },
].map(evidence => Object.freeze({
  ...evidence,
  actualTechniqueCounts: Object.freeze({ ...evidence.actualTechniqueCounts }),
})));

// Complete 60-level playable catalog. Stable level IDs are independent of slot order.
const PLAYABLE = [
  {
    "slot": 1,
    "levelId": "star-double-tutorial-01",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 65.4,
    "humanTraceLength": 64,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10,16,17,18,24,25,26,49|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed",
    "dominantTechnique": "DOUBLE_STAR_RULES",
    "keyTechniques": [
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量",
      "行列星域联动"
    ],
    "reasoningFingerprint": "00db8b28c018ca52e49e4875f8d78cae5a55c72e870d24bd776113d3a9ba97fb",
    "exactTraceHash": "8ec9cbf93dfa5ceaefcbde514e78df066358799bad11ce2906104757d1956a4c",
    "generationSeed": 20260724,
    "generationIndex": 0
  },
  {
    "slot": 2,
    "levelId": "star-double-tutorial-02",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 65.7,
    "humanTraceLength": 64,
    "deductionWaveCount": 6,
    "openingSignature": "TWO_BY_TWO_CAPACITY|11,12,16,17,18,19,24,26,27,28,29,30,31,32,33,34,35|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "9f78bf3b1878369efe2235e22ebb44201a9490646e875d05d8b390b3fdc715e4",
    "exactTraceHash": "a82033d15504597393754dcce87a5d8539c7cbc6b0e98b7af8333ae3b70f011b",
    "generationSeed": 20642868,
    "generationIndex": 23
  },
  {
    "slot": 3,
    "levelId": "star-double-tutorial-03",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 66.8,
    "humanTraceLength": 64,
    "deductionWaveCount": 5,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,2,3,4,8,10,12,16,17,18,19,20,24,25,26,27,28,33,35,41,43,49,51,57,59|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|expansive|inner-spread",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "配额已满",
      "星域形状限制",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "84e0df18296e5a6e672e040996984a6d22b7c7213a6f5cae578b90e421a0c9f0",
    "exactTraceHash": "f6b63942629d7730d88a54a068d576fe71a482b5e0d55655ed7ac81962a2c397",
    "generationSeed": 20560734,
    "generationIndex": 0
  },
  {
    "slot": 4,
    "levelId": "star-double-tutorial-04",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 77.7,
    "humanTraceLength": 64,
    "deductionWaveCount": 6,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,2,3,9,10,11,17,19,25,26,27,33,34,35,42,50,58|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "2×2容量"
    ],
    "reasoningFingerprint": "9164e3c82f5f310b9bf88261dfbd7ffdd02e9a503cbef7c510b02692365fd1e1",
    "exactTraceHash": "a91b7e2cc65ca790574983635afed8a718c5c616e106437218f42502f4ee97f2",
    "generationSeed": 20700332,
    "generationIndex": 5
  },
  {
    "slot": 5,
    "levelId": "star-double-tutorial-05",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 81.3,
    "humanTraceLength": 64,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|16,17,18,19,24,26,27,28,29,30,31,32,33,34,35,46|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "70e41edfe4167717dd9c571d338a555e5776225779c432ff363ed6b9fa452f0d",
    "exactTraceHash": "7b660fdf34707207e8aa24f09ce63bd5fb04d098631ea13ca580a1340fefa4fd",
    "generationSeed": 20832011,
    "generationIndex": 9
  },
  {
    "slot": 6,
    "levelId": "star-double-tutorial-06",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 91.3,
    "humanTraceLength": 64,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10,11|4",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "a180e633e25bb33f2b8d5400f837dbee16237340f6bf96936a04c4811f74e18f",
    "exactTraceHash": "d84164df1b9901c8ee29166e18aeb7cbe659b98a72a04ef9d518f55aaa15f8af",
    "generationSeed": 20260724,
    "generationIndex": 5
  },
  {
    "slot": 7,
    "levelId": "star-double-tutorial-07",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 99.1,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,2,3,8,10,11,12,13,14,15,16,17,18,19|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|edge-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "3686490ef1dc19c3473b9e745bb8e544c72f2ed83acea8bd72982b73e482e249",
    "exactTraceHash": "7017fdae6435230c73825c0bb6254418002c757a3bedeba16142347d130d67da",
    "generationSeed": 20960746,
    "generationIndex": 0
  },
  {
    "slot": 8,
    "levelId": "star-double-tutorial-08",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 103.5,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|16,23,24,26,27,41,42,43|3",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|broad|inner-spread",
    "dominantTechnique": "PRESSURED_GROUP_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "8525fb061336de97ac335e727e9975c92af9660288e9fe0c7dcd9e4268dddb59",
    "exactTraceHash": "6a9ccab253d579bd6c921d5a042151915516677cd8edad07b38a2d042f108826",
    "generationSeed": 20260724,
    "generationIndex": 7
  },
  {
    "slot": 9,
    "levelId": "star-double-tutorial-09",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 104.8,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "CONFINED_CAPACITY|0,1,2,3,4,6,7,11,12,13,14,15,28,29|0",
    "openingFamily": "CONFINED_CAPACITY|opening-star|wide|edge-spread",
    "dominantTechnique": "PROPAGATION_CHAIN",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "0f486ef6c726a0694297d84eed75b4f20b5dfc9ecfc52253378ddff4832d9aba",
    "exactTraceHash": "40b8510b97cccb0dbdff44e17bbc1511754bb277f6acfe035d200b21ceaa06cb",
    "generationSeed": 21192428,
    "generationIndex": 4
  },
  {
    "slot": 10,
    "levelId": "star-double-tutorial-10",
    "boardSize": 8,
    "source": "tutorial-new",
    "difficultyScore": 105.8,
    "humanTraceLength": 64,
    "deductionWaveCount": 10,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|10,14,58|1",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|focused|center-spread",
    "dominantTechnique": "COMBINED_BASICS",
    "keyTechniques": [
      "共同冲突排除",
      "剩余位置收束",
      "行列星域联动",
      "2×2容量"
    ],
    "reasoningFingerprint": "5d82dd3b358a2a747c7a7834e2f01f7ad6e389ee48d298ff1405725843fd2192",
    "exactTraceHash": "4cecc951497d944a50adb79d5ae607db7e13594e907478b874e209c341ab350f",
    "generationSeed": 20260724,
    "generationIndex": 9
  },
  {
    "slot": 11,
    "levelId": "star-double-promoted-02",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 109.4,
    "humanTraceLength": 64,
    "deductionWaveCount": 5,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|14,22,39|1",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "94de7f71f7520dd3b3e57e0a9e0ff87c7c3104aeba4aedb440792b385778e961",
    "exactTraceHash": "db177b81435dc902a685e84aadde83c02f12560e3630c7c7f3ee14942111ed97",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 12,
    "levelId": "star-double-promoted-03",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 109.8,
    "humanTraceLength": 64,
    "deductionWaveCount": 6,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,2,3,12,13,14,15,32,33,34,40,46,47,49,50|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|wide|center-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "行列星域联动",
      "星域形状限制",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "97796eee1ae7de18703bcf6f5caddb481495242b9ea12630bdd74e1d88ddc8d0",
    "exactTraceHash": "0d91b59d58333b49f6ccc6432df13d6eb76a0f73c3e9b6e38fab44bb127af685",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 13,
    "levelId": "star-double-promoted-01",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 110,
    "humanTraceLength": 64,
    "deductionWaveCount": 5,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,2,9,17,25|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "04aa726fae758dc412732f0bd58aed307c8c474347965baafef46c62091d8d7a",
    "exactTraceHash": "4c41bd07923553d7383ab145589ad9c9afc6510a55d6238eb39109ac45f60dea",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 14,
    "levelId": "star-lv-22",
    "boardSize": 8,
    "source": "existing-official",
    "difficultyScore": 110.1,
    "humanTraceLength": 64,
    "deductionWaveCount": 6,
    "openingSignature": "TWO_BY_TWO_CAPACITY|16,20,21,24,26,28,41|2",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed",
    "dominantTechnique": "PRESSURED_GROUP_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "行列星域联动"
    ],
    "reasoningFingerprint": "e8141cdd88601f793b0cf7fb0aadae20e54bd841d3887d2f95fd3c913957b99d",
    "exactTraceHash": "58bb14b15dd33353cc28fce0c88fa8da5428251a3ed07db588c2ad80643a1392",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 15,
    "levelId": "star-double-promoted-08",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 112,
    "humanTraceLength": 64,
    "deductionWaveCount": 6,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|1,9,32|2",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "行列星域联动"
    ],
    "reasoningFingerprint": "0ab1f2b34b49e5a470c1b5140e539f45e07ea3d5f7d5e475b94090d4714d643c",
    "exactTraceHash": "558999322ab4139388ccc5815022a5622c70cbe8dc90e4a241ece73ac7184bb9",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 16,
    "levelId": "star-double-promoted-07",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 114,
    "humanTraceLength": 64,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|16,17,19,23,27,29,31|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|center-mixed",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "22a2c3c1ff93037af972c6cd81018d4733ecdf59771625b3adca0abaaa6452db",
    "exactTraceHash": "2a7d9dd289c3f180ee7158b95b934477622718f9e9f6a792398ec79fa4f7f4f2",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 17,
    "levelId": "star-double-promoted-12",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 114.1,
    "humanTraceLength": 64,
    "deductionWaveCount": 7,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|0,1,2,3,12,13,14,15|2",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|broad|edge-mixed",
    "dominantTechnique": "PRESSURED_GROUP_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "1a0ddf181f7d330499e2cc2af139bfb90137cc7cb493e7c508fb296053ff0f2a",
    "exactTraceHash": "8c94cf05e6f7649945b574e938bd245086c61cc74fdba3d178cee8bce6e98161",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 18,
    "levelId": "star-double-promoted-13",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 115,
    "humanTraceLength": 64,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10,18|2",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|narrow|inner-compact",
    "dominantTechnique": "PRESSURED_GROUP_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "行列星域联动"
    ],
    "reasoningFingerprint": "8a5ffd7e46a1a2666bd233fc8f4fa04f07c69b5900402fe4f41af56d23bd3e62",
    "exactTraceHash": "4e5c3c921cf16cca42c43f0fa034acf63ea931febff114c2d42c3162466f632b",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 19,
    "levelId": "star-lv-21",
    "boardSize": 8,
    "source": "existing-official",
    "difficultyScore": 115.6,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "CONFINED_CAPACITY|0,1,2|2",
    "openingFamily": "CONFINED_CAPACITY|early-star|focused|edge-compact",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "6cc83178aa09a86d51978f6be764d23bf84b9b8fb1cf42a719adb850e0e62673",
    "exactTraceHash": "3fc7e9536944022e09d6fe9c33dd902c4c0896ba64eeeaa01ba9e89d57a16fb6",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 20,
    "levelId": "star-double-promoted-05",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 115.6,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|19,27,28,29|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|center-compact",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "365d87e3ceb0495a8123c1b88464a118419bc9d54ed3fb3880a28bdc3c93059a",
    "exactTraceHash": "4f240a5d9e81b089d2f87c350d9a19248a0d33de319df71f7082f3ed4a163865",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 21,
    "levelId": "star-double-promoted-10",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 116,
    "humanTraceLength": 64,
    "deductionWaveCount": 7,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|1,17,32|3",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|mid-star|focused|edge-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "46dd20b172eed73d8c7ff945a23be7d96b21d239fbd45d43ff485655b79b69ea",
    "exactTraceHash": "c2432540d81aa391492659ae13109cc08216174a88181a49e22da687b7e155ee",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 22,
    "levelId": "star-double-expansion-02",
    "boardSize": 8,
    "source": "generated-expansion",
    "difficultyScore": 118.3,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10|3",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "行列星域联动"
    ],
    "reasoningFingerprint": "2d8633eefbf628f96c4f7ddd58fa850f5a8f65c489e044adaea938f9c5b366b0",
    "exactTraceHash": "0a7414323ccab893fb7a2692cc0d67fe5e0c31576e14c79a6ca382fa13667504",
    "generationSeed": 20260726,
    "generationIndex": 7
  },
  {
    "slot": 23,
    "levelId": "star-double-expansion-04",
    "boardSize": 8,
    "source": "generated-expansion",
    "difficultyScore": 118.9,
    "humanTraceLength": 64,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10|2",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|narrow|edge-compact",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "ea2c4ff6384e322c6bfbddfebfeb3dcd6764ed6dea8db1b8ee54d948e6d2a204",
    "exactTraceHash": "274f7e0c7f31355d48209daf7fc121896a93d16e20151f77ed50a0568e39c39a",
    "generationSeed": 20260726,
    "generationIndex": 11
  },
  {
    "slot": 24,
    "levelId": "star-double-promoted-06",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 119.3,
    "humanTraceLength": 64,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|13,14|4",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "行列星域联动",
      "星域形状限制",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "978458205e7d5dd2404ceecc35729bdcf0eb58a0468301ccee38d45f00d54ca7",
    "exactTraceHash": "edeaedd8162fd19d07734857e4bd2e750d36a45b05590efdf436d02b8b2bc713",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 25,
    "levelId": "star-double-expansion-01",
    "boardSize": 8,
    "source": "generated-expansion",
    "difficultyScore": 119.8,
    "humanTraceLength": 64,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,3,4,8,9,11,12|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "2×2容量"
    ],
    "reasoningFingerprint": "516408ce7c53e421e4130bf00f725111bc3f85b9790186addd0e67cc02944aa0",
    "exactTraceHash": "622ee2b0e1246a03bf89fc1c16bbfa81e550735e4332ef002fe22619adeda92d",
    "generationSeed": 20260726,
    "generationIndex": 0
  },
  {
    "slot": 26,
    "levelId": "star-double-expansion-03",
    "boardSize": 8,
    "source": "generated-expansion",
    "difficultyScore": 120.5,
    "humanTraceLength": 64,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|16,34|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|narrow|edge-mixed",
    "dominantTechnique": "PRESSURED_GROUP_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "行列星域联动",
      "星域形状限制",
      "配额已满"
    ],
    "reasoningFingerprint": "9f8831d75db8a207595cbd3a479fab0be0f923839a486307ce382b3b82307ca2",
    "exactTraceHash": "522ec936ae48b2cc64290bd28bc595f56ed2f5fe768f90ab9cad589d47898635",
    "generationSeed": 20260726,
    "generationIndex": 9
  },
  {
    "slot": 27,
    "levelId": "star-double-promoted-04",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 120.3,
    "humanTraceLength": 64,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,17|4",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|narrow|edge-compact",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "ccc225792a9973ca5808dd10bc91898f7e458cbfa20bd04a1900ab86e8c85bf9",
    "exactTraceHash": "a6092a46b21fd4777eb2233566906704e7aed698f138528961964f1df213333c",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 28,
    "levelId": "star-double-promoted-09",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 121.5,
    "humanTraceLength": 64,
    "deductionWaveCount": 9,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|16,20,21|2",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|focused|inner-mixed",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "8fb5b6391f8d11b5f34ffe47bcc804a484cb2667fabc5b26923aa12f0827605e",
    "exactTraceHash": "65de1cbcc0863c864c8fd08d5f4ec1f0fcfba5b79dedc6b34e25250f39b3cd21",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 29,
    "levelId": "star-double-promoted-11",
    "boardSize": 8,
    "source": "promoted-candidate",
    "difficultyScore": 126.1,
    "humanTraceLength": 64,
    "deductionWaveCount": 12,
    "openingSignature": "TWO_BY_TWO_CAPACITY|12,13,14|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "e0f0f690a68ec291bc409dca25993e5b5adfe0f93a36a4f108865eab35489ec2",
    "exactTraceHash": "90ecab68c89ac8cec2fe4de4b2fe51a06750af13e87dd35d372a4ec9a3255124",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 30,
    "levelId": "star-lv-23",
    "boardSize": 8,
    "source": "existing-official",
    "difficultyScore": 137.4,
    "humanTraceLength": 64,
    "deductionWaveCount": 16,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,2,19,25,26,27,33,34,35|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "f933f5adb675f818bd07fd76632524b0c74be12af2d95919b4f2c0eeff995438",
    "exactTraceHash": "d3ae6ffe8a6fe71a2306b5fabbdb463946e7aaeded5f9bad31094d8906287836",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 31,
    "levelId": "star-double-expansion-09",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 117.4,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,7,8,11,14,20,25,27,28,29,34,35,36,37,38,43,44|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "0e2701d657f2e97c4358a2b886c4c30438d7a66fe592488cce509801f19f6023",
    "exactTraceHash": "7be45a1454032e910978805f7c49f7fccb13084df5b00d95a01b4f6efd616c8d",
    "generationSeed": 20260726,
    "generationIndex": 28
  },
  {
    "slot": 32,
    "levelId": "star-lv-24",
    "boardSize": 9,
    "source": "existing-official",
    "difficultyScore": 118.5,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "CONFINED_CAPACITY|1,2,3,12,28,29,37,55|0",
    "openingFamily": "CONFINED_CAPACITY|opening-star|broad|inner-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "1265cefade160df994606ec78805199056cd9109472dda4dadd1f1082b0871ff",
    "exactTraceHash": "373a955fc5d1e9650f38af4e96ee4df20365d1510c0e03f22b63e476cb462580",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 33,
    "levelId": "star-double-expansion-08",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 118.6,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "CONFINED_CAPACITY|0,27,36,37,38,43,44|1",
    "openingFamily": "CONFINED_CAPACITY|early-star|broad|inner-spread",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "e50ce403227cc1b6276de0f82c7b93c4110114b2a3bb071761959783a7d9893a",
    "exactTraceHash": "1ee55230b8077688c0fb8de711423499b386f5a3d53789aba4e118b1b19c6f6e",
    "generationSeed": 20260726,
    "generationIndex": 20
  },
  {
    "slot": 34,
    "levelId": "star-double-promoted-17",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 119.2,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,37,38,39,47,48,55,56,57|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "82260dcc09472e6edb4bf15b3406418924ff1d9c3afffc3700b83450e22f7974",
    "exactTraceHash": "c312943856e66e215e824b0408bdf0d2aa624060d26e03c850cd39666406d6e9",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 35,
    "levelId": "star-lv-26",
    "boardSize": 9,
    "source": "existing-official",
    "difficultyScore": 119.8,
    "humanTraceLength": 81,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,3,10,12,13,20,22,29,31,43,57,66,67,75,76|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|wide|center-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "行列星域联动",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "d567b2c70a7fd31ddd50ddaee92b1c86ad878b2eda0a70ee4d1cf1bf93dbb0d1",
    "exactTraceHash": "4f18fe55afeda032f8b43cdce169d9feba8f7c04c16bbbcabab8f53d84384368",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 36,
    "levelId": "star-double-promoted-20",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 119.9,
    "humanTraceLength": 81,
    "deductionWaveCount": 8,
    "openingSignature": "CONFINED_CAPACITY|0,1,2,3,4,6,7,8,12,13,14,15,16,32|0",
    "openingFamily": "CONFINED_CAPACITY|opening-star|wide|edge-spread",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "33b08ac726a96485f3877b6d45f6c46e6d72fbe28c402463ec1df8bf45aa101d",
    "exactTraceHash": "13317081a9f6c0b6ef1ace48ec215d3a891443e4b73d0d5004dc9a24aa3aa3d6",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 37,
    "levelId": "star-double-promoted-16",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 120.4,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,10,11,12,13,20,21,22,23,25,27,29,31,32,34,42,48,49,51,60,69,78|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "行列星域联动",
      "配额已满"
    ],
    "reasoningFingerprint": "13e09b3bc42246f7062424347722e0b1b013b7b400bd4a018d19493b65adcab9",
    "exactTraceHash": "b2b9fab1ecbef508edfbbdefb623fd27464a50d481764bf0a38ae02d5f301404",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 38,
    "levelId": "star-double-expansion-05",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 120.9,
    "humanTraceLength": 81,
    "deductionWaveCount": 7,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,10,37,46,47,55,66|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|edge-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "d30d7630d5cee1a35451399aaa56b85690bc1ade007b642850ff4e94b195e6a3",
    "exactTraceHash": "70fdb165c44634870720d19776540edfce5d411eccbd91221e6abf76719193cf",
    "generationSeed": 20260726,
    "generationIndex": 10
  },
  {
    "slot": 39,
    "levelId": "star-double-expansion-06",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 122.6,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,20,21,22,27,28,30,31,36,39,40|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|inner-mixed",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "剩余位置收束",
      "星域形状限制",
      "2×2容量"
    ],
    "reasoningFingerprint": "5e043d19d8197ca92418783cf72efb3458861ad92111aa1046c3d45a518a489d",
    "exactTraceHash": "d832ed44c083d3b98f9335fb923f645f94713bc8f779fdb2b238b509b51b11c2",
    "generationSeed": 20260726,
    "generationIndex": 11
  },
  {
    "slot": 40,
    "levelId": "star-double-expansion-13",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 123.9,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|18,19,31,36,38,45,47,48|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|edge-mixed",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "6347b4f65ebcdd1261d863b0f812f754b6b609c2d04d04633a8aafe11d1bb05b",
    "exactTraceHash": "ee779ff75a55f38a6084df66af3b1b5c2f9ffd032dd2aa715c6f13733943560b",
    "generationSeed": 20260727,
    "generationIndex": 7
  },
  {
    "slot": 41,
    "levelId": "star-double-promoted-18",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 125.4,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10,11,18,28,29,30,37,38,55,56,57|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "行列星域联动"
    ],
    "reasoningFingerprint": "a265b82047ee7a6713a6b953ec1d396343a85a220195351f88d1e060e19bae0d",
    "exactTraceHash": "3accf30eb7b745b9808c8e9e69596ad3581c97a6d7fe700b257c4ba603b6cfba",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 42,
    "levelId": "star-lv-25",
    "boardSize": 9,
    "source": "existing-official",
    "difficultyScore": 125.3,
    "humanTraceLength": 81,
    "deductionWaveCount": 11,
    "openingSignature": "TWO_BY_TWO_CAPACITY|18,19,27,28,37,54,55|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|edge-mixed",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "共同冲突排除",
      "剩余位置收束",
      "星域形状限制",
      "2×2容量"
    ],
    "reasoningFingerprint": "c8fee09f58fc00ef4b1d4c196e241c5db3bf13e0375cb433153af0022d9cc1f6",
    "exactTraceHash": "57a174f0b937efa56a195405a54e3c4ecd6f02c66ecd8ee17f8108840484753c",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 43,
    "levelId": "star-double-expansion-07",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 125.5,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,2,9,10,11,18,37,38,39,40,57,60,67,69|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|inner-spread",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "ba64b94ded23f07a014ca3ba06891f8ae816263d31df015bdf65c228315e3d76",
    "exactTraceHash": "9fa0c29450883a843b10249563abdd060fa75a1ba1f578c6ed3e942c4dacb7c9",
    "generationSeed": 20260726,
    "generationIndex": 13
  },
  {
    "slot": 44,
    "levelId": "star-double-expansion-11",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 125.9,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|18,19,45,46,54,55,57,64,76|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|broad|edge-spread",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "fad16b293ae3488509775d0bef71a542ea7eb173ed256716a0f8de143403a953",
    "exactTraceHash": "9fd92dd77549d6ebfe4ef14e9e8c979ea500c274486c8313705667a91fc7ccc4",
    "generationSeed": 20260726,
    "generationIndex": 33
  },
  {
    "slot": 45,
    "levelId": "star-double-promoted-14",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 126.2,
    "humanTraceLength": 81,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|12,13,23,25,32,34,35,43|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|inner-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "1f6d7a3df6936e5ef8f711f9e0fc6d3f4df854adaf0bae281109ad87921bb385",
    "exactTraceHash": "b709ced6b6fdbe7f57fc175a02c6f24ff0370e2949f0536e10602241dc0e0262",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 46,
    "levelId": "star-lv-27",
    "boardSize": 9,
    "source": "existing-official",
    "difficultyScore": 129.6,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|10,11,12|3",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|focused|edge-compact",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "79661b7efc323284b345cea290b3fd03e29bfcd63ec8a6002933d63d9564739c",
    "exactTraceHash": "565076953e9cad6668ab70600639b56e850a66788ba18646fbd534775d3f8029",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 47,
    "levelId": "star-double-expansion-10",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 129.9,
    "humanTraceLength": 81,
    "deductionWaveCount": 12,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,36,37|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "d60c084db0dbfe57a79f5341e8b34b4693231620faca14d1ca7b9c9e0d747fe6",
    "exactTraceHash": "fe2548a4579df27c0f493b219a76d1385de72fc3e715b542bdfbfe67c5a8b3aa",
    "generationSeed": 20260726,
    "generationIndex": 29
  },
  {
    "slot": 48,
    "levelId": "star-double-promoted-19",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 130.3,
    "humanTraceLength": 81,
    "deductionWaveCount": 12,
    "openingSignature": "TWO_BY_TWO_CAPACITY|21,22,23,39,40|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|center-compact",
    "dominantTechnique": "REMAINING_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "cb37cf2e897bff9e0e0df13b995e079f1572db040b64b3e8df7ead7404aaf30e",
    "exactTraceHash": "bf821f444cbc4c707bc92dd6d29f35f6dc152346c39f53ed6343b6ef161ed0d9",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 49,
    "levelId": "star-double-expansion-12",
    "boardSize": 9,
    "source": "generated-expansion",
    "difficultyScore": 130.6,
    "humanTraceLength": 81,
    "deductionWaveCount": 10,
    "openingSignature": "CONFINED_CAPACITY|11,52|2",
    "openingFamily": "CONFINED_CAPACITY|early-star|narrow|center-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "dbc5f042621bf37d21f130a8a780d4cd03e0fd698ec59d76bbdc28614863c5c0",
    "exactTraceHash": "2f60415156c24a7169d8fe962e7c536e578c04e29883a7b3cbfe07bfe11cf471",
    "generationSeed": 20260727,
    "generationIndex": 2
  },
  {
    "slot": 50,
    "levelId": "star-double-promoted-15",
    "boardSize": 9,
    "source": "promoted-candidate",
    "difficultyScore": 132.3,
    "humanTraceLength": 81,
    "deductionWaveCount": 12,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,36,37|2",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "8d8ac5ffe270def24a4dfe8ea43becadf93719584a7fbe2994392a6b100ccb77",
    "exactTraceHash": "eb20820a9eb95bdc0d03629a7f95293ee09c749e4f5d0dbd72a7446840e7d1dc",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 51,
    "levelId": "star-lv-28",
    "boardSize": 10,
    "source": "existing-official",
    "difficultyScore": 127.6,
    "humanTraceLength": 100,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,11,14,15,21,33,35,41,43,44,45,46,51,53,54,55,60,61,65,67,75,76,77,85,86,87,90,91|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|expansive|center-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "星域形状限制",
      "行列星域联动",
      "剩余位置收束",
      "共同冲突排除"
    ],
    "reasoningFingerprint": "f8cc384fda4b560c255d7a6d729adbb3b15e6bf5f93e4bb8a69072a497333884",
    "exactTraceHash": "324e561740b357fc9ede0362ccb625d2bb7cdbade231ed9fdaabef49a16790f0",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 52,
    "levelId": "star-double-expansion-16",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 128.8,
    "humanTraceLength": 100,
    "deductionWaveCount": 8,
    "openingSignature": "TWO_BY_TWO_CAPACITY|1,10,11,12,20,21,22,30,32,40,41,42,50,51,52,61,71,81,91|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|edge-spread",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "62aba60d4a091ab5d247b3405dcd4b956cbd90be6a635c13b0535f0b9073dda7",
    "exactTraceHash": "2b3db167bea9973c89bd5b7b52f32226413c0edf4c8a187c3b85265c369ad0a6",
    "generationSeed": 20260726,
    "generationIndex": 17
  },
  {
    "slot": 53,
    "levelId": "star-lv-29",
    "boardSize": 10,
    "source": "existing-official",
    "difficultyScore": 134.1,
    "humanTraceLength": 100,
    "deductionWaveCount": 10,
    "openingSignature": "TWO_BY_TWO_CAPACITY|0,1,11,15,16,21,31,34,36,44,45,46,54,55,56,61,71,91|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "行列星域联动",
      "共同冲突排除",
      "剩余位置收束",
      "星域形状限制"
    ],
    "reasoningFingerprint": "ef71ac9d2314ba8494929e7f00c3a62a37ce8901a0f6b205d8b440a5ad9a41e5",
    "exactTraceHash": "8da312e992c12dd6d4d20a303e8ce61bc356218638852bc56091b2d345f3d8d9",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 54,
    "levelId": "star-double-expansion-14",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 134.2,
    "humanTraceLength": 100,
    "deductionWaveCount": 9,
    "openingSignature": "TWO_BY_TWO_CAPACITY|11,12,13,14,15,16,17,18,53,54,55,63,64,65,75,82,83,92,93,94|0",
    "openingFamily": "TWO_BY_TWO_CAPACITY|opening-star|wide|center-spread",
    "dominantTechnique": "ADJACENCY_EXCLUSION",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "行列星域联动"
    ],
    "reasoningFingerprint": "42ae42f3071e5dfab3507aa60616092792957c5ce7a453ebb4d8c9c4ac32dc0f",
    "exactTraceHash": "132c781b88a6e2ddd2717d5f2d24b61716273514377703d9507438bed3d1f192",
    "generationSeed": 20260726,
    "generationIndex": 10
  },
  {
    "slot": 55,
    "levelId": "star-double-expansion-17",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 134.7,
    "humanTraceLength": 100,
    "deductionWaveCount": 9,
    "openingSignature": "CONFINED_CAPACITY|0,1,2,3,8,9,14,15,16,17,18,28,68,78,88|2",
    "openingFamily": "CONFINED_CAPACITY|early-star|wide|inner-spread",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "剩余位置收束",
      "2×2容量"
    ],
    "reasoningFingerprint": "4561abac2a0acec1c8b3b8ca2d2e6e3c0ce42a68d1ea95a6d46ac8872f752ed2",
    "exactTraceHash": "89bd59ae4c759e8203f087cbba9b80d6dc8a25824f8882d757e0212694cc76e9",
    "generationSeed": 20260726,
    "generationIndex": 18
  },
  {
    "slot": 56,
    "levelId": "star-double-expansion-19",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 141.3,
    "humanTraceLength": 100,
    "deductionWaveCount": 11,
    "openingSignature": "TWO_BY_TWO_CAPACITY|13,14,32,33,34,35,42,54,55|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|broad|center-mixed",
    "dominantTechnique": "CONFINED_CAPACITY",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "f1954681d274e936681b11bf8b3092ee818a995646f5ecc590fe099dac7c9b42",
    "exactTraceHash": "c7dfb7c8f353dedfa0ed6f880b708ef4907d0bc9b288ed624e11fae085923a97",
    "generationSeed": 20260726,
    "generationIndex": 28
  },
  {
    "slot": 57,
    "levelId": "star-double-expansion-15",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 145.7,
    "humanTraceLength": 100,
    "deductionWaveCount": 14,
    "openingSignature": "TWO_BY_TWO_CAPACITY|11,13,14,16,17,31,32|3",
    "openingFamily": "TWO_BY_TWO_CAPACITY|mid-star|broad|edge-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "2d4cf6c46a5cdb4615f771c09d70ab90b1a7d805bc1dc3e2fb9cb226278c526b",
    "exactTraceHash": "aa0e73db9fdd94b91e6a62e0c997da9affc4cdbfeff64a3a72201784840025d4",
    "generationSeed": 20260726,
    "generationIndex": 12
  },
  {
    "slot": 58,
    "levelId": "star-double-promoted-21",
    "boardSize": 10,
    "source": "promoted-candidate",
    "difficultyScore": 146.8,
    "humanTraceLength": 100,
    "deductionWaveCount": 14,
    "openingSignature": "MULTI_UNIT_CONFINEMENT|11,12,13,14,17|1",
    "openingFamily": "MULTI_UNIT_CONFINEMENT|early-star|focused|edge-mixed",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "剩余位置收束",
      "配额已满"
    ],
    "reasoningFingerprint": "39d61021df1d40944d513309d3bd1cf10f5e2a1f30e9fca4141e9a4856bdaa7e",
    "exactTraceHash": "5c59cb61016d34e632d3a4bf8e4382f25e68d64ac7a1cab06c597898c599b4f1",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 59,
    "levelId": "star-lv-30",
    "boardSize": 10,
    "source": "existing-official",
    "difficultyScore": 148.6,
    "humanTraceLength": 100,
    "deductionWaveCount": 15,
    "openingSignature": "TWO_BY_TWO_CAPACITY|2,4,12,14,33|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact",
    "dominantTechnique": "MULTI_UNIT_CONFINEMENT",
    "keyTechniques": [
      "星域形状限制",
      "共同冲突排除",
      "行列星域联动",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "c7bb760a70c03bc1abfbb21c3ba86a948e9f817c7d437b2a2bb31451f82dc092",
    "exactTraceHash": "4fe76823ab3c9ed09356c392a5186ff8456d544d9b3faad9d3ccc61ef5dfbdd6",
    "generationSeed": null,
    "generationIndex": null
  },
  {
    "slot": 60,
    "levelId": "star-double-expansion-18",
    "boardSize": 10,
    "source": "generated-expansion",
    "difficultyScore": 147.7,
    "humanTraceLength": 100,
    "deductionWaveCount": 14,
    "openingSignature": "TWO_BY_TWO_CAPACITY|11,12,13|1",
    "openingFamily": "TWO_BY_TWO_CAPACITY|early-star|focused|edge-compact",
    "dominantTechnique": "QUOTA_SATURATED",
    "keyTechniques": [
      "共同冲突排除",
      "星域形状限制",
      "配额已满",
      "剩余位置收束"
    ],
    "reasoningFingerprint": "0a29d0600776e00dc9e1021dc49e7767735750a0389397eb552d8007d2846762",
    "exactTraceHash": "d5a0d2a45257ae62379d3911e607ad46a554943061e8fc0e2c874632bbc91dc8",
    "generationSeed": 20260726,
    "generationIndex": 26
  }
].map(entry => Object.freeze({
  ...entry,
  keyTechniques: Object.freeze(entry.keyTechniques),
}));

export const STAR_DOUBLE_CURRICULUM = Object.freeze(PLAYABLE.map(entry => {
  const tutorialNumber = entry.source === 'tutorial-new' ? entry.slot : null;
  const teachingFocus = tutorialNumber
    ? TUTORIAL_FOCUS[tutorialNumber - 1]
    : '双星基础逻辑综合运用';
  return Object.freeze({
    ...entry,
    displayLevel: entry.slot,
    status: 'playable',
    teachingFocus,
    difficultyEvidence: tutorialNumber
      ? STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE[tutorialNumber - 1]
      : null,
    sortingReason: tutorialNumber
      ? `教学课程固定第 ${tutorialNumber} 课`
      : `${entry.boardSize}×${entry.boardSize} 内按综合难度 ${entry.difficultyScore} 排序，并通过相邻开局与相似度门禁`,
  });
}));

export const STAR_DOUBLE_PLAYABLE_CURRICULUM = STAR_DOUBLE_CURRICULUM;

export function getStarDoubleCurriculumSlot(levelId) {
  return STAR_DOUBLE_CURRICULUM.find(entry => entry.levelId === levelId) || null;
}
