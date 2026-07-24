export const STAR_DOUBLE_CURRICULUM_VERSION = 'star-double-curriculum-1.0.0';

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
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 9, firstStarDepth: 6, forcedMoveRatio: 0.333, longestPropagationChain: 9, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 70.7, changeReason: '首颗确定星延后两波，且不再揭示具体操作格。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 47, REMAINING_CAPACITY: 16, QUOTA_SATURATED: 1 }, humanTraceLength: 64, deductionWaveCount: 10, firstStarDepth: 5, forcedMoveRatio: 0.4, longestPropagationChain: 10, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 74, changeReason: '新增配额满足排除，完整传播增至十波。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 7, firstStarDepth: 4, forcedMoveRatio: 0.429, longestPropagationChain: 7, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 79.5, changeReason: '进入基础独立推理阶段；链条更短，但不再依赖规则认识期的引导。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 48, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 5, forcedMoveRatio: 0.375, longestPropagationChain: 8, crossUnitReasoningCount: 0, independentBeforeHintRatio: 1, difficultyScore: 84.1, changeReason: '首颗星更晚，传播增加一波，并要求持续寻找同一单位的第二颗。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 43, REMAINING_CAPACITY: 16, CONFINED_CAPACITY: 5 }, humanTraceLength: 64, deductionWaveCount: 10, firstStarDepth: 5, forcedMoveRatio: 0.5, longestPropagationChain: 10, crossUnitReasoningCount: 5, independentBeforeHintRatio: 1, difficultyScore: 89.5, changeReason: '首次加入区域形状限制，出现五次跨单位推理并形成十波链。' },
  { actualTechniqueCounts: { CONFINED_CAPACITY: 13, TWO_BY_TWO_CAPACITY: 34, MULTI_UNIT_CONFINEMENT: 1, REMAINING_CAPACITY: 16 }, humanTraceLength: 64, deductionWaveCount: 7, firstStarDepth: 4, forcedMoveRatio: 0.429, longestPropagationChain: 7, crossUnitReasoningCount: 14, independentBeforeHintRatio: 1, difficultyScore: 97.3, changeReason: '进入联动阶段；跨单位推理由五次升至十四次。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 18, MULTI_UNIT_CONFINEMENT: 6, PRESSURED_GROUP_EXCLUSION: 10, ADJACENCY_EXCLUSION: 3, CONFINED_CAPACITY: 13, REMAINING_CAPACITY: 8, QUOTA_SATURATED: 6 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 3, forcedMoveRatio: 0.5, longestPropagationChain: 8, crossUnitReasoningCount: 29, independentBeforeHintRatio: 1, difficultyScore: 103.5, changeReason: '加入两位置共同排除，跨单位推理增至二十九次。' },
  { actualTechniqueCounts: { TWO_BY_TWO_CAPACITY: 28, MULTI_UNIT_CONFINEMENT: 2, CONFINED_CAPACITY: 6, PRESSURED_GROUP_EXCLUSION: 12, QUOTA_SATURATED: 12, REMAINING_CAPACITY: 4 }, humanTraceLength: 64, deductionWaveCount: 8, firstStarDepth: 3, forcedMoveRatio: 0.625, longestPropagationChain: 8, crossUnitReasoningCount: 20, independentBeforeHintRatio: 1, difficultyScore: 104.1, changeReason: '不新增规则，重点转为把已有结论连续传播到下一单位。' },
  { actualTechniqueCounts: { MULTI_UNIT_CONFINEMENT: 4, TWO_BY_TWO_CAPACITY: 36, PRESSURED_GROUP_EXCLUSION: 6, ADJACENCY_EXCLUSION: 1, REMAINING_CAPACITY: 10, QUOTA_SATURATED: 5, CONFINED_CAPACITY: 2 }, humanTraceLength: 64, deductionWaveCount: 10, firstStarDepth: 1, forcedMoveRatio: 0.6, longestPropagationChain: 10, crossUnitReasoningCount: 12, independentBeforeHintRatio: 1, difficultyScore: 105.8, changeReason: '不新增规则；以十波完整链综合复用前九课知识，并保持低于 Lv.11。' },
].map(evidence => Object.freeze({
  ...evidence,
  actualTechniqueCounts: Object.freeze({ ...evidence.actualTechniqueCounts }),
})));

// slot, levelId, size, source, score, trace, waves, normalized reasoning fingerprint
const PLAYABLE = [
  [1,'star-double-tutorial-01',8,'tutorial-new',65.4,64,9,'00db8b28c018ca52e49e4875f8d78cae5a55c72e870d24bd776113d3a9ba97fb'],
  [2,'star-double-tutorial-02',8,'tutorial-new',70.7,64,9,'7b1c924b7e53bccfc4779ee0881251f0a97eacda2ee2eccf606a82b9f08514f0'],
  [3,'star-double-tutorial-03',8,'tutorial-new',74,64,10,'6f8d375df3cbe318006484637587857921d56e7d4b9c08bb769bd50f09d64b73'],
  [4,'star-double-tutorial-04',8,'tutorial-new',79.5,64,7,'4956b15bedec0590d347732af4fba98979d997547295e08e98fcfd3f3bbb0738'],
  [5,'star-double-tutorial-05',8,'tutorial-new',84.1,64,8,'154c71e84b187a655f51b1f8d25c4848f0fada2347b34f4f6cafc5ac3cb47e75'],
  [6,'star-double-tutorial-06',8,'tutorial-new',89.5,64,10,'bcf00033f27e998f764616312000b34a39e6ca1a71be9065250d3a71bdfab4e3'],
  [7,'star-double-tutorial-07',8,'tutorial-new',97.3,64,7,'11bbcf7bcb4f9a99460e6aeef9c49806a1105b45a52435cc636aa221c6fcd6c5'],
  [8,'star-double-tutorial-08',8,'tutorial-new',103.5,64,8,'8525fb061336de97ac335e727e9975c92af9660288e9fe0c7dcd9e4268dddb59'],
  [9,'star-double-tutorial-09',8,'tutorial-new',104.1,64,8,'93a029d1de9345cdd155965ae74ee4329c7cdc421c713ee4291ce8071749a399'],
  [10,'star-double-tutorial-10',8,'tutorial-new',105.8,64,10,'5d82dd3b358a2a747c7a7834e2f01f7ad6e389ee48d298ff1405725843fd2192'],
  [11,'star-double-promoted-03',8,'promoted-candidate',108.2,64,6,'97796eee1ae7de18703bcf6f5caddb481495242b9ea12630bdd74e1d88ddc8d0'],
  [12,'star-lv-22',8,'existing-official',108.6,64,6,'e8141cdd88601f793b0cf7fb0aadae20e54bd841d3887d2f95fd3c913957b99d'],
  [13,'star-double-promoted-02',8,'promoted-candidate',108.9,64,5,'94de7f71f7520dd3b3e57e0a9e0ff87c7c3104aeba4aedb440792b385778e961'],
  [14,'star-double-promoted-01',8,'promoted-candidate',109.2,64,5,'04aa726fae758dc412732f0bd58aed307c8c474347965baafef46c62091d8d7a'],
  [15,'star-double-promoted-12',8,'promoted-candidate',113.4,64,7,'1a0ddf181f7d330499e2cc2af139bfb90137cc7cb493e7c508fb296053ff0f2a'],
  [16,'star-double-promoted-08',8,'promoted-candidate',113.8,64,6,'0ab1f2b34b49e5a470c1b5140e539f45e07ea3d5f7d5e475b94090d4714d643c'],
  [17,'star-double-promoted-07',8,'promoted-candidate',114.5,64,7,'22a2c3c1ff93037af972c6cd81018d4733ecdf59771625b3adca0abaaa6452db'],
  [18,'star-double-promoted-05',8,'promoted-candidate',119.3,64,8,'365d87e3ceb0495a8123c1b88464a118419bc9d54ed3fb3880a28bdc3c93059a'],
  [19,'star-double-promoted-10',8,'promoted-candidate',120.5,64,7,'46dd20b172eed73d8c7ff945a23be7d96b21d239fbd45d43ff485655b79b69ea'],
  [20,'star-double-promoted-13',8,'promoted-candidate',120.8,64,7,'8a5ffd7e46a1a2666bd233fc8f4fa04f07c69b5900402fe4f41af56d23bd3e62'],
  [21,'star-lv-21',8,'existing-official',121.1,64,8,'6cc83178aa09a86d51978f6be764d23bf84b9b8fb1cf42a719adb850e0e62673'],
  [22,'star-double-promoted-06',8,'promoted-candidate',127.7,64,9,'978458205e7d5dd2404ceecc35729bdcf0eb58a0468301ccee38d45f00d54ca7'],
  [23,'star-double-promoted-04',8,'promoted-candidate',129.5,64,9,'ccc225792a9973ca5808dd10bc91898f7e458cbfa20bd04a1900ab86e8c85bf9'],
  [24,'star-double-promoted-09',8,'promoted-candidate',129.5,64,9,'8fb5b6391f8d11b5f34ffe47bcc804a484cb2667fabc5b26923aa12f0827605e'],
  [25,'star-double-promoted-11',8,'promoted-candidate',136.3,64,12,'e0f0f690a68ec291bc409dca25993e5b5adfe0f93a36a4f108865eab35489ec2'],
  [26,'star-lv-23',8,'existing-official',148.7,64,16,'f933f5adb675f818bd07fd76632524b0c74be12af2d95919b4f2c0eeff995438'],
  [31,'star-lv-24',9,'existing-official',118.1,81,7,'1265cefade160df994606ec78805199056cd9109472dda4dadd1f1082b0871ff'],
  [32,'star-double-promoted-17',9,'promoted-candidate',121.3,81,7,'82260dcc09472e6edb4bf15b3406418924ff1d9c3afffc3700b83450e22f7974'],
  [33,'star-double-promoted-20',9,'promoted-candidate',122.8,81,8,'33b08ac726a96485f3877b6d45f6c46e6d72fbe28c402463ec1df8bf45aa101d'],
  [34,'star-double-promoted-16',9,'promoted-candidate',122.9,81,7,'13e09b3bc42246f7062424347722e0b1b013b7b400bd4a018d19493b65adcab9'],
  [35,'star-lv-26',9,'existing-official',124.5,81,8,'d567b2c70a7fd31ddd50ddaee92b1c86ad878b2eda0a70ee4d1cf1bf93dbb0d1'],
  [36,'star-double-promoted-18',9,'promoted-candidate',131.1,81,10,'a265b82047ee7a6713a6b953ec1d396343a85a220195351f88d1e060e19bae0d'],
  [37,'star-double-promoted-14',9,'promoted-candidate',132.4,81,9,'1f6d7a3df6936e5ef8f711f9e0fc6d3f4df854adaf0bae281109ad87921bb385'],
  [38,'star-lv-25',9,'existing-official',132.4,81,11,'c8fee09f58fc00ef4b1d4c196e241c5db3bf13e0375cb433153af0022d9cc1f6'],
  [39,'star-lv-27',9,'existing-official',142.6,81,10,'79661b7efc323284b345cea290b3fd03e29bfcd63ec8a6002933d63d9564739c'],
  [40,'star-double-promoted-19',9,'promoted-candidate',143,81,12,'cb37cf2e897bff9e0e0df13b995e079f1572db040b64b3e8df7ead7404aaf30e'],
  [41,'star-double-promoted-15',9,'promoted-candidate',145.6,81,12,'8d8ac5ffe270def24a4dfe8ea43becadf93719584a7fbe2994392a6b100ccb77'],
  [51,'star-lv-28',10,'existing-official',129.8,100,8,'f8cc384fda4b560c255d7a6d729adbb3b15e6bf5f93e4bb8a69072a497333884'],
  [52,'star-lv-29',10,'existing-official',143.3,100,10,'ef71ac9d2314ba8494929e7f00c3a62a37ce8901a0f6b205d8b440a5ad9a41e5'],
  [53,'star-double-promoted-21',10,'promoted-candidate',164.9,100,14,'39d61021df1d40944d513309d3bd1cf10f5e2a1f30e9fca4141e9a4856bdaa7e'],
  [54,'star-lv-30',10,'existing-official',164.9,100,15,'c7bb760a70c03bc1abfbb21c3ba86a948e9f817c7d437b2a2bb31451f82dc092'],
];

const playableBySlot = new Map(PLAYABLE.map(row => [row[0], row]));

function sizeForSlot(slot) {
  return STAR_DOUBLE_SIZE_RANGES.find(
    range => slot >= range.startSlot && slot <= range.endSlot,
  )?.boardSize ?? null;
}

export const STAR_DOUBLE_CURRICULUM = Object.freeze(Array.from({ length: 60 }, (_, index) => {
  const slot = index + 1;
  const row = playableBySlot.get(slot);
  if (!row) {
    return Object.freeze({
      slot, displayLevel: slot, status: 'reserved', levelId: null,
      boardSize: sizeForSlot(slot), source: 'reserved', teachingFocus: '未来课程保留位',
      difficultyScore: null, humanTraceLength: null, deductionWaveCount: null,
      keyTechniques: Object.freeze([]), reasoningFingerprint: null, difficultyEvidence: null,
      sortingReason: '对应尺寸区间末尾的未来课程保留位',
    });
  }
  const [displayLevel, levelId, boardSize, source, difficultyScore,
    humanTraceLength, deductionWaveCount, reasoningFingerprint] = row;
  const teachingFocus = source === 'tutorial-new'
    ? TUTORIAL_FOCUS[displayLevel - 1]
    : '双星基础逻辑综合运用';
  return Object.freeze({
    slot, displayLevel, status: 'playable', levelId, boardSize, source,
    teachingFocus, difficultyScore, humanTraceLength, deductionWaveCount,
    difficultyEvidence: source === 'tutorial-new'
      ? STAR_DOUBLE_TEACHING_DIFFICULTY_EVIDENCE[displayLevel - 1]
      : null,
    keyTechniques: Object.freeze(source === 'tutorial-new'
      ? ['双星配额', '八向不相邻', '2×2容量', teachingFocus]
      : ['容量排除', '配额收束', '跨单位推理', '连续传播']),
    reasoningFingerprint,
    sortingReason: source === 'tutorial-new'
      ? `教学课程固定第 ${displayLevel} 课`
      : `${boardSize}×${boardSize} 内按综合难度 ${difficultyScore} 排序`,
  });
}));

export const STAR_DOUBLE_PLAYABLE_CURRICULUM = Object.freeze(
  STAR_DOUBLE_CURRICULUM.filter(entry => entry.status === 'playable'),
);

export function getStarDoubleCurriculumSlot(levelId) {
  return STAR_DOUBLE_PLAYABLE_CURRICULUM.find(entry => entry.levelId === levelId) || null;
}
