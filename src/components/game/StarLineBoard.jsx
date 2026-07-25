import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Star, Undo2 } from 'lucide-react';
import { getStarLineCompletionTiming, getStarLineStarDelay } from '../../game/starLine/starLineFeedbackTiming.js';
import useStarLineInputController from '../../hooks/useStarLineInputController.js';
import {
  canSafelyReplayStarLineGuide,
  resolveStarLineOperationStep,
  resolveStarLineRuleStep,
} from '../../hooks/useStarLineGuide.js';
import {
  canSafelyReplayStarLineDoubleGuide,
} from '../../hooks/useStarLineDoubleGuide.js';
import StarLineGuideOverlay from '../StarLineGuideOverlay.jsx';
import { STAR_LINE_TUTORIAL_CONTRACT } from '../../game/starLine/starLineTutorialContract.js';
import {
  resolveStarLineDoubleTutorialCells,
  STAR_LINE_DOUBLE_TUTORIAL_CONTRACT,
} from '../../game/starLine/starLineDoubleTutorialContract.js';
import { findStarLineDoubleBasicHint } from '../../game/starLine/starLineDoubleBasicHints.js';
import { getStarLineRuleCopy } from '../../config/gameExplanations.js';
import {
  getStarDoubleLessonContract,
} from '../../game/starLine/starLineDoubleLessonContracts.js';
import { findAllProofs } from '../../game/starLine/starLineDoubleLessonEngine.js';

function StarLineX({ size, className, ...props }) {
  const s = size;
  const inset = s * 0.25;
  const sw = s * 0.12;
  return (
    <svg
      width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round"
      className={className}
      {...props}
    >
      <line x1={inset} y1={inset} x2={s - inset} y2={s - inset} />
      <line x1={s - inset} y1={inset} x2={inset} y2={s - inset} />
    </svg>
  );
}

const CONFLICT_LABELS = [
  ['row', '同行'],
  ['col', '同列'],
  ['region', '星域'],
  ['adjacency', '相邻'],
];

const EMPTY_COUNTS = [];
const DOUBLE_HINT_DELAY_MS = 10000;
const { operation: OP, rules: RL } = STAR_LINE_TUTORIAL_CONTRACT;
const GREEN_REGION = STAR_LINE_TUTORIAL_CONTRACT.greenRegion;
const DOUBLE_GUIDE = STAR_LINE_DOUBLE_TUTORIAL_CONTRACT;
const OPERATION_GUIDE = {
  1: { copy: '单击空格，标记这里不能放星。', targets: [OP.tapX], pointer: OP.tapX, path: [], gesture: 'tap' },
  2: { copy: '从空白格开始拖动，可以连续排除。', targets: OP.addDragPath, pointer: OP.addDragPath[0], path: OP.addDragPath, gesture: 'drag' },
  3: { copy: '从 X 开始拖动，可以连续清除。', targets: OP.clearDragPath, pointer: OP.clearDragPath[0], path: OP.clearDragPath, gesture: 'drag' },
  4: { copy: '双击确定的位置，放置星点。', targets: [OP.firstStar], pointer: OP.firstStar, path: [], gesture: 'double-tap' },
};

function createEmptySatisfiedUnits() {
  return { rows: new Set(), cols: new Set(), regions: new Set() };
}

function isStarGesture(type) {
  return type === 'double-place-star' || type === 'double-x-to-star';
}

function includesEvery(indexes, expected) {
  const set = new Set(indexes || []);
  return expected.every(idx => set.has(idx));
}

function getDoubleBoardStateHash(gridData) {
  const signature = gridData.map(cell => (
    cell?.isStarred ? 'S' : cell?.isMarkedX ? 'X' : 'U'
  )).join('');
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getDoubleDeductionId(hint) {
  if (!hint) return null;
  return [
    hint.mode || 'deduction',
    hint.rule || 'unknown',
    hint.action || 'unknown',
    [...(hint.targetCells || [])].sort((a, b) => a - b).join(','),
  ].join(':');
}

function createDoubleDeduction(hint, boardStateHash, contextKey) {
  const deductionId = getDoubleDeductionId(hint);
  if (!deductionId) return null;
  return {
    contextKey,
    deductionId,
    boardStateHash,
    bindingKey: `${deductionId}@${boardStateHash}`,
    hint,
  };
}

function isDoubleDeductionComplete(deduction, gridData) {
  if (!deduction?.hint?.targetCells?.length) return false;
  const { action, targetCells } = deduction.hint;
  if (action === 'place-stars') {
    return targetCells.every(idx => gridData[idx]?.isStarred && !gridData[idx]?.isMarkedX);
  }
  if (action === 'eliminate') {
    return targetCells.every(idx => gridData[idx]?.isMarkedX && !gridData[idx]?.isStarred);
  }
  if (action === 'clear') {
    return targetCells.every(idx => !gridData[idx]?.isStarred && !gridData[idx]?.isMarkedX);
  }
  return false;
}

function DelayedDoubleGuideHintButton({
  timerKey,
  onClick,
  onStatusChange,
  prefersReducedMotion,
}) {
  const startedAtRef = useRef(null);
  const lastPublishedStatusRef = useRef('');
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let timer = null;
    startedAtRef.current = Date.now();
    const tick = () => {
      const elapsed = Math.min(DOUBLE_HINT_DELAY_MS, Date.now() - startedAtRef.current);
      const remainingSeconds = Math.max(
        0,
        Math.ceil((DOUBLE_HINT_DELAY_MS - elapsed) / 1000),
      );
      const unlocked = elapsed >= DOUBLE_HINT_DELAY_MS;
      const publishedStatus = `${remainingSeconds}:${unlocked}`;
      setElapsedMs(elapsed);
      if (publishedStatus !== lastPublishedStatusRef.current) {
        lastPublishedStatusRef.current = publishedStatus;
        onStatusChange({ timerKey, remainingSeconds, unlocked });
      }
      if (elapsed < DOUBLE_HINT_DELAY_MS) {
        timer = setTimeout(tick, 100);
      }
    };
    timer = setTimeout(tick, 100);
    return () => clearTimeout(timer);
  }, [onStatusChange, timerKey]);

  const unlocked = elapsedMs >= DOUBLE_HINT_DELAY_MS;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((DOUBLE_HINT_DELAY_MS - elapsedMs) / 1000),
  );
  const animatedMaskHeight = 100 * (1 - elapsedMs / DOUBLE_HINT_DELAY_MS);
  const maskHeight = unlocked ? 0 : prefersReducedMotion ? 100 : animatedMaskHeight;

  return (
    <button
      type="button"
      className="starline-double-guide-card__button is-delayed-hint"
      data-countdown-seconds={remainingSeconds}
      data-hint-unlocked={unlocked ? 'true' : 'false'}
      data-testid="star-line-double-guide-action"
      onClick={onClick}
      disabled={!unlocked}
    >
      <span className="starline-double-guide-card__button-label">
        {unlocked ? '查看提示' : `${remainingSeconds} 秒后解锁`}
      </span>
      {!unlocked && (
        <span
          aria-hidden="true"
          className="starline-double-guide-card__countdown-mask"
          data-testid="star-line-double-guide-countdown-mask"
          style={{ height: `${maskHeight}%` }}
        />
      )}
    </button>
  );
}

export default function StarLineBoard({
  level,
  gridData,
  state,
  inputKey,
  cellActions,
  showSolution = false,
  solutionCells = [],
  undoLast,
  canUndo = false,
  beginBatch,
  commitBatch,
  inputBlocked = false,
  guidance,
  guidanceActions,
  doubleGuidance,
  doubleGuidanceActions,
  prefersReducedMotion = false,
}) {
  const [showIntroHint, setShowIntroHint] = useState(true);
  const [showAssistHighlight, setShowAssistHighlight] = useState(false);
  const [activeStatusIdx, setActiveStatusIdx] = useState(null);
  const [exitMarks, setExitMarks] = useState(() => new Map());
  const exitTimersRef = useRef(new Map());
  const [placeEffects, setPlaceEffects] = useState(() => new Set());
  const placeTimersRef = useRef(new Map());
  const [satisfiedUnits, setSatisfiedUnits] = useState(createEmptySatisfiedUnits);
  const satisfactionTimerRef = useRef(null);
  const pendingStarGestureRef = useRef(null);
  const previousCountsRef = useRef(null);
  const reconciledInputKeyRef = useRef(null);
  const [guideNudge, setGuideNudge] = useState(false);
  const [doubleHintState, setDoubleHintState] = useState({
    bindingKey: null,
    level: 0,
  });
  const [doubleHintTimerStatus, setDoubleHintTimerStatus] = useState(null);
  const [storedDoubleDeduction, setStoredDoubleDeduction] = useState(null);
  const guideMissCountRef = useRef(0);
  const guideNudgeTimerRef = useRef(null);
  const hasPlayedCompleteRef = useRef(false);
  const isComplete = state.isComplete;
  const N = level.N;
  const regions = level.regions;
  const quota = state.quota ?? level?.starsPerRow ?? level?.starsPerCol ?? level?.starsPerRegion ?? 1;
  const completionTiming = getStarLineCompletionTiming(level);
  const conflictCells = state.conflictCells || new Set();
  const rowCounts = state.rowCounts || EMPTY_COUNTS;
  const colCounts = state.colCounts || EMPTY_COUNTS;
  const regionCounts = state.regionCounts || EMPTY_COUNTS;
  const isFirstGuideLevel = level.id === 'star-lv-01';
  const isFirstDoubleGuideLevel = level.id === DOUBLE_GUIDE.levelId;
  // v3: Lesson contract for Lv.2-10
  const lessonContract = useMemo(() => getStarDoubleLessonContract(level?.id), [level?.id]);
  const isTeachingLevel = isFirstDoubleGuideLevel || Boolean(lessonContract);
  // Session-only teaching step (not persisted)
  const [lessonStep, setLessonStep] = useState(1);
  // Check if lesson was already completed
  const lessonCompleted = isTeachingLevel
    ? (doubleGuidance?.completedLessons?.[level?.id] || (isFirstDoubleGuideLevel && doubleGuidance?.completed))
    : false;
  // Replay check: active when replayLevelId matches (even if previously completed)
  const lessonReplayPending = Boolean(
    doubleGuidance?.replayLevelId === level?.id
  );
  const operationIncomplete = !guidance?.operation?.completed;
  const replayPending = Boolean(guidance?.replayRequested && guidance?.operation?.completed);
  const replayBlocked = isFirstGuideLevel && replayPending && !canSafelyReplayStarLineGuide(gridData);
  const operationGuideActive = isFirstGuideLevel && operationIncomplete;
  const ruleGuideActive = isFirstGuideLevel
    && Boolean(guidance?.operation?.completed)
    && !guidance?.rules?.completed
    && !guidance?.replayRequested;
  const operationStep = guidance?.operation?.step || 1;
  const ruleStep = guidance?.rules?.step || 1;
  const doubleReplayPending = Boolean(doubleGuidance?.completed && doubleGuidance?.replayRequested);
  const doubleReplayBlocked = isFirstDoubleGuideLevel
    && doubleReplayPending
    && !canSafelyReplayStarLineDoubleGuide(gridData);
  const doubleGuideActive = isTeachingLevel && (!lessonCompleted || lessonReplayPending);
  const doubleTeachingStepCount = lessonContract?.steps?.length || DOUBLE_GUIDE.steps.length;
  const doubleBoardStateHash = useMemo(
    () => getDoubleBoardStateHash(gridData),
    [gridData],
  );
  const doubleDeductionContextKey = `${inputKey}:${lessonStep}`;
  const doubleBasicHint = useMemo(() => (
    doubleGuideActive && lessonStep === doubleTeachingStepCount
      ? findStarLineDoubleBasicHint(level, gridData)
      : null
  ), [doubleGuideActive, lessonStep, doubleTeachingStepCount, gridData, level]);
  const candidateDoubleDeduction = useMemo(() => (
    createDoubleDeduction(
      doubleBasicHint,
      doubleBoardStateHash,
      doubleDeductionContextKey,
    )
  ), [doubleBasicHint, doubleBoardStateHash, doubleDeductionContextKey]);
  const activeDoubleDeduction = useMemo(() => {
    if (storedDoubleDeduction?.contextKey !== doubleDeductionContextKey) {
      return candidateDoubleDeduction;
    }
    const completed = isDoubleDeductionComplete(storedDoubleDeduction, gridData);
    const correctionTakesOver = candidateDoubleDeduction?.hint.mode === 'correction'
      && storedDoubleDeduction.hint.mode !== 'correction';
    return completed || correctionTakesOver
      ? candidateDoubleDeduction
      : storedDoubleDeduction;
  }, [
    candidateDoubleDeduction,
    doubleDeductionContextKey,
    gridData,
    storedDoubleDeduction,
  ]);

  const ruleGuide = useMemo(() => {
    if (!ruleGuideActive) return null;
    if (ruleStep === 1) {
      return {
        copy: '每一行需要 1 个星点。把右边的空格标成 X。',
        targets: RL.firstRowHighlight,
        interactive: true,
        demoPaths: [RL.firstRowDemoPath],
        gesture: 'drag',
      };
    }
    if (ruleStep === 2) {
      return {
        copy: '每一列也需要 1 个星点。把其余空格标成 X。',
        targets: RL.starColumnHighlight,
        interactive: true,
        demoPaths: [RL.starColumnDoneX],
        gesture: 'drag',
      };
    }
    if (ruleStep === 3) {
      return {
        copy: '每片星域同样需要 1 个星点。双击绿色星域中的高亮格。',
        targets: [RL.secondStar],
        interactive: true,
        pointer: RL.secondStar,
        gesture: 'double-tap',
      };
    }
    if (ruleStep === 4) {
      return {
        copy: '这片绿色星域已经有 1 个星点，把其余格标成 X。',
        targets: GREEN_REGION,
        interactive: true,
        demoPaths: RL.greenRegionDemoPaths,
        gesture: 'drag',
      };
    }
    if (ruleStep === 5) {
      return {
        copy: '星点之间不能相邻，包括斜向。周围八格都要标成 X。',
        targets: RL.adjacencyHighlight,
        autoAdvanceMs: 2400,
      };
    }
    if (ruleStep === 6) {
      return {
        copy: '这一行只剩一个空格，双击放置星点。',
        targets: [RL.thirdStar],
        interactive: true,
        pointer: RL.thirdStar,
        gesture: 'double-tap',
      };
    }
    if (ruleStep === 7) {
      return {
        copy: '这一列已有星点，把其余空格标成 X。',
        targets: RL.thirdColumnHighlight,
        interactive: true,
        demoPaths: [RL.thirdColumnDemoPath],
        gesture: 'drag',
      };
    }
    if (ruleStep === 8) {
      return {
        copy: '这个星域只有一个格，双击放置星点。',
        targets: [RL.fourthStar],
        interactive: true,
        pointer: RL.fourthStar,
        gesture: 'double-tap',
      };
    }
    if (ruleStep === 9) {
      return {
        copy: '根据行、列和相邻规则，把这些格标成 X。',
        targets: RL.tailDoneX,
        interactive: true,
        demoPaths: RL.tailDemoPaths,
        gesture: 'drag',
      };
    }
    return {
      copy: '最后一行只剩一个空格，双击放置最后一个星点。',
      targets: [RL.finalStar],
      interactive: true,
      pointer: RL.finalStar,
      gesture: 'double-tap',
    };
  }, [ruleGuideActive, ruleStep]);

  const doubleRuleGuide = useMemo(() => {
    if (!doubleGuideActive) return null;
    const steps = lessonContract?.steps || DOUBLE_GUIDE.steps;
    const step = steps[lessonStep - 1];
    if (!step) return null;

    // Cell resolver: Lv.1 always uses legacy resolver (it has special logic like actionSource).
    // Lv.2-10 use contract's explicit cell arrays.
    const resolveCells = (s, kind) => {
      if (isFirstDoubleGuideLevel) {
        return resolveStarLineDoubleTutorialCells(s, kind);
      }
      // Lv.2-10: use contract's explicit cell arrays
      if (kind === 'actions') return s.actionCells || [];
      if (kind === 'observation') return s.observationCells || [];
      if (kind === 'evidence') return s.evidenceCells || [];
      if (kind === 'pointers') return s.pointerCells || [];
      return [];
    };

    const actionCells = resolveCells(step, 'actions');
    const isAutonomous = step.type === 'autonomous';
    const isIndependentJudgment = Boolean(step.delayedHint);
    const supportsHints = isAutonomous || isIndependentJudgment;
    const hintBindingKey = isAutonomous
      ? activeDoubleDeduction?.bindingKey || null
      : isIndependentJudgment
        ? `guided:${inputKey}:${lessonStep}`
        : null;
    const hintLevel = supportsHints && doubleHintState.bindingKey === hintBindingKey
      ? doubleHintState.level
      : 0;
    const maxHintLevel = isAutonomous ? 3 : isIndependentJudgment ? 1 : 0;
    const activeHint = isAutonomous ? activeDoubleDeduction?.hint : null;
    const interactive = isAutonomous || step.type === 'place-stars' || step.type === 'eliminate';
    const correctionMode = activeHint?.mode === 'correction';
    const observationCells = isAutonomous
      && hintLevel >= (correctionMode ? 2 : 1)
      ? activeHint?.observationCells || []
      : resolveCells(step, 'observation');
    const evidenceCells = isAutonomous && hintLevel >= 2
      ? activeHint?.evidenceCells || []
      : isIndependentJudgment && hintLevel >= 1
        ? step.delayedHint?.evidenceCells || []
        : resolveCells(step, 'evidence');
    const actionHighlightCells = isAutonomous && hintLevel >= 3
      ? activeHint?.targetCells || []
      : step.revealAction ? actionCells : [];
    const targets = [...new Set([
      ...observationCells,
      ...evidenceCells,
      ...actionHighlightCells,
    ])];
    const copy = isAutonomous && hintLevel > 0
      ? activeHint?.[`tier${hintLevel}Copy`] || '先检查当前标记是否符合三条基础规则。'
      : isIndependentJudgment && hintLevel > 0
        ? step.delayedHint?.copy
        : step.copy;
    const hintAvailable = isAutonomous ? Boolean(activeHint) : isIndependentJudgment;

    // Proof-driven interactive step: Lv.2-10 guided/practice with no static actionCells
    // uses dynamic proof engine → allow full board interaction when proof is valid
    const currentBoardHash = doubleBoardStateHash;
    const isProofDrivenStep = !isFirstDoubleGuideLevel
      && interactive
      && ['setup', 'guided', 'practice'].includes(step.type);
    const activeProof = isProofDrivenStep
      ? findAllProofs({ N, regions, starsPerRow: quota }, gridData).find(
          p => p.technique === step.technique || p.action === step.expectedAction
        ) || findAllProofs({ N, regions, starsPerRow: quota }, gridData)[0]
      : null;
    const hasValidProof = activeProof && activeProof.boardStateHash === currentBoardHash;
    const isProofDrivenInteractiveStep = isProofDrivenStep && hasValidProof;

    return {
      ...step,
      copy,
      targets,
      actionCells,
      observationCells,
      evidenceCells,
      actionHighlightCells,
      interactiveTargets: (isAutonomous || isProofDrivenInteractiveStep) ? null : interactive ? actionCells : [],
      interactive,
      pointerTargets: resolveCells(step, 'pointers'),
      isProofDrivenStep,
      activeProof,
      hasValidProof,
      hintLevel,
      hintAvailable,
      hintCanAdvance: hintAvailable && hintLevel < maxHintLevel,
      hintMaxLevel: maxHintLevel,
      hintBindingKey,
      usesDelayedHint: supportsHints,
      hintMode: isAutonomous ? activeHint?.mode || 'deduction' : null,
      deductionId: isAutonomous ? activeDoubleDeduction?.deductionId || null : null,
      deductionBoardStateHash: isAutonomous
        ? activeDoubleDeduction?.boardStateHash || null
        : null,
      deductionAction: isAutonomous ? activeHint?.action || null : null,
      deductionTargetCells: isAutonomous ? activeHint?.targetCells || [] : [],
    };
  }, [
    activeDoubleDeduction,
    doubleGuideActive,
    doubleHintState,
    lessonStep,
    inputKey,
    lessonContract,
    level,
  ]);

  const activeGuide = operationGuideActive
    ? OPERATION_GUIDE[operationStep]
    : ruleGuide || doubleRuleGuide;
  const guideTargetSet = useMemo(() => new Set(activeGuide?.targets || []), [activeGuide]);
  const guideObservationSet = useMemo(
    () => new Set(activeGuide?.observationCells || []),
    [activeGuide],
  );
  const guideEvidenceSet = useMemo(
    () => new Set(activeGuide?.evidenceCells || []),
    [activeGuide],
  );
  const guideActionSet = useMemo(
    () => new Set(activeGuide?.actionHighlightCells || []),
    [activeGuide],
  );
  const guideInteractiveTargetSet = useMemo(() => (
    activeGuide?.interactiveTargets ? new Set(activeGuide.interactiveTargets) : null
  ), [activeGuide]);
  const guideKind = operationGuideActive
    ? 'operation'
    : ruleGuideActive
      ? 'rule'
      : doubleGuideActive
        ? 'double-rule'
        : null;
  const guideBlocksInput = (ruleGuideActive && !ruleGuide?.interactive)
    || (doubleGuideActive && !doubleRuleGuide?.interactive);
  const doubleGuideLocksUndo = doubleGuideActive && lessonStep < doubleTeachingStepCount;
  const canInteractWithGuideCell = useCallback((idx) => (
    !guideInteractiveTargetSet || guideInteractiveTargetSet.has(idx)
  ), [guideInteractiveTargetSet]);

  const handleCellCleared = useCallback(({ idx, kind, source }) => {
    setExitMarks(prev => {
      const next = new Map(prev);
      next.set(idx, { kind, source });
      return next;
    });
    clearTimeout(exitTimersRef.current.get(idx));
    const duration = kind === 'star' ? 110 : 100;
    exitTimersRef.current.set(idx, setTimeout(() => {
      setExitMarks(prev => {
        const next = new Map(prev);
        next.delete(idx);
        return next;
      });
      exitTimersRef.current.delete(idx);
    }, duration));
  }, []);

  const recordGuideMiss = useCallback(() => {
    guideMissCountRef.current += 1;
    if (guideMissCountRef.current < 2) return;
    setGuideNudge(true);
    clearTimeout(guideNudgeTimerRef.current);
    guideNudgeTimerRef.current = setTimeout(() => setGuideNudge(false), 1400);
  }, []);

  const handleGestureComplete = useCallback((gesture) => {
    const isOperationStar = operationGuideActive
      && operationStep === 4
      && gesture.startIdx === OP.firstStar
      && isStarGesture(gesture.type);

    if (isStarGesture(gesture.type)) {
      pendingStarGestureRef.current = { ...gesture, wasOperationGesture: isOperationStar };
    }

    if (!operationGuideActive) return;

    let completedStep = false;
    if (operationStep === 1) {
      completedStep = gesture.type === 'single-add-x'
        && gesture.startIdx === 0
        && includesEvery(gesture.addedIndexes, [0]);
    } else if (operationStep === 2) {
      completedStep = gesture.type === 'drag-add-x'
        && [2, 3, 4].includes(gesture.startIdx)
        && includesEvery(gesture.addedIndexes, [2, 3, 4]);
    } else if (operationStep === 3) {
      completedStep = gesture.type === 'drag-clear-x'
        && gesture.startIdx === 4
        && includesEvery(gesture.clearedIndexes, [4, 3, 2]);
    } else if (operationStep === 4) {
      completedStep = isOperationStar;
    }

    if (!completedStep) {
      recordGuideMiss();
      return;
    }

    guideMissCountRef.current = 0;
    setGuideNudge(false);
    if (operationStep < 4) guidanceActions?.setOperationStep(operationStep + 1);
  }, [guidanceActions, operationGuideActive, operationStep, recordGuideMiss]);

  // Proof-driven action validation for Lv.2-10 guided/practice steps
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const feedbackTimerRef = useRef(null);

  const showFeedback = useCallback((msg) => {
    setFeedbackMessage(msg);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedbackMessage(null), 2000);
  }, []);

  const validatedCellActions = useMemo(() => {
    if (!doubleRuleGuide?.isProofDrivenStep || !doubleRuleGuide?.activeProof) {
      return cellActions;
    }
    const proof = doubleRuleGuide.activeProof;
    return {
      ...cellActions,
      setCellStar: (idx, ...args) => {
        if (proof.action !== 'place-star' || !proof.derivedTargets.includes(idx)) {
          showFeedback('这里还不能确定是星。继续观察高亮区域。');
          return;
        }
        cellActions.setCellStar(idx, ...args);
      },
      setCellExcluded: (idx, ...args) => {
        if (proof.action !== 'eliminate' || !proof.derivedTargets.includes(idx)) {
          showFeedback(proof.action === 'place-star' ? '这里还不需要标 X，先找星的位置。' : '不在当前推理目标中。检查高亮的观察范围。');
          return;
        }
        cellActions.setCellExcluded(idx, ...args);
      },
    };
  }, [cellActions, doubleRuleGuide?.isProofDrivenStep, doubleRuleGuide?.activeProof, showFeedback]);

  const {
    pressedIdx,
    pendingTapIdx,
    isDragging,
    gridPointerHandlers,
  } = useStarLineInputController({
    interactionKey: inputKey,
    boardSize: N,
    cellActions: validatedCellActions,
    beginBatch,
    commitBatch,
    disabled: inputBlocked || isComplete || guideBlocksInput,
    onActiveCellChange: setActiveStatusIdx,
    onCellCleared: handleCellCleared,
    onGestureComplete: handleGestureComplete,
    canInteractWithCell: canInteractWithGuideCell,
  });

  // ── Hover 高亮 ──
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const highlightCells = useMemo(() => {
    if (!showAssistHighlight || hoveredIdx === null) return new Set();
    const set = new Set();
    const row = Math.floor(hoveredIdx / N);
    const col = hoveredIdx % N;
    const rid = regions[hoveredIdx];
    gridData.forEach((_, idx) => {
      if (Math.floor(idx / N) === row) set.add(idx);
      if (idx % N === col) set.add(idx);
      if (regions[idx] === rid) set.add(idx);
    });
    return set;
  }, [showAssistHighlight, hoveredIdx, N, regions, gridData]);

  const regionBoundaryPath = useMemo(() => {
    const segments = [];
    for (let row = 0; row < N; row += 1) {
      for (let col = 0; col < N; col += 1) {
        const idx = row * N + col;
        const regionId = regions[idx];
        if (row === 0) segments.push(`M ${col} ${row} H ${col + 1}`);
        if (col === 0) segments.push(`M ${col} ${row} V ${row + 1}`);
        if (row === N - 1 || regions[idx + N] !== regionId) {
          segments.push(`M ${col} ${row + 1} H ${col + 1}`);
        }
        if (col === N - 1 || regions[idx + 1] !== regionId) {
          segments.push(`M ${col + 1} ${row} V ${row + 1}`);
        }
      }
    }
    return segments.join(' ');
  }, [N, regions]);

  // 星点放置顺序 —— 用于通关时星阵依次 pulse 的 stagger delay
  const starOrder = useMemo(() => {
    const map = new Map();
    let seq = 0;
    gridData.forEach((cell, idx) => {
      if (cell.isStarred) map.set(idx, seq++);
    });
    return map;
  }, [gridData]);

  useEffect(() => {
    if (reconciledInputKeyRef.current === inputKey) return;
    reconciledInputKeyRef.current = inputKey;
    previousCountsRef.current = {
      inputKey,
      rows: [...rowCounts],
      cols: [...colCounts],
      regions: [...regionCounts],
    };
    if (!isFirstGuideLevel) return;
    if (guidance?.operation?.completed) {
      if (!guidance?.rules?.completed && !gridData[1]?.isStarred) {
        guidanceActions?.returnToStarPlacement();
      }
      return;
    }
    const resolvedStep = resolveStarLineOperationStep(guidance?.operation?.step || 1, gridData);
    if (resolvedStep === 5) guidanceActions?.completeOperation();
    else if (resolvedStep !== guidance?.operation?.step) guidanceActions?.setOperationStep(resolvedStep);
  }, [guidance?.operation?.completed, guidance?.operation?.step, guidance?.rules?.completed, guidanceActions, gridData, inputKey, isFirstGuideLevel, rowCounts, colCounts, regionCounts]);

  useEffect(() => {
    if (!ruleGuideActive) return;
    const resolvedStep = resolveStarLineRuleStep(ruleStep, gridData);
    if (resolvedStep === 0) {
      guidanceActions?.returnToStarPlacement();
      return;
    }
    if (resolvedStep === 11) {
      if (isComplete) guidanceActions?.completeRules();
      else if (ruleStep !== 10) guidanceActions?.setRuleStep(10);
      return;
    }
    if (resolvedStep !== ruleStep) guidanceActions?.setRuleStep(resolvedStep);
  }, [gridData, guidanceActions, isComplete, ruleGuideActive, ruleStep]);

  useEffect(() => {
    if (!doubleGuideActive) return;
    if (lessonStep === doubleTeachingStepCount && isComplete) {
      doubleGuidanceActions?.completeLesson(level.id);
      return;
    }
    // Resolve step: check if current step's action cells are completed
    const steps = lessonContract?.steps || DOUBLE_GUIDE.steps;
    let resolvedStep = lessonStep;
    const currentStepData = steps[lessonStep - 1];
    if (currentStepData && (currentStepData.type === 'place-stars' || currentStepData.type === 'eliminate')) {
      const resolveForStep = isFirstDoubleGuideLevel
        ? (s) => resolveStarLineDoubleTutorialCells(s, 'actions')
        : (s) => s.actionCells || [];
      const cells = resolveForStep(currentStepData);
      if (cells.length > 0) {
        const done = cells.every(idx => {
          if (currentStepData.type === 'place-stars') return gridData?.[idx]?.isStarred && !gridData?.[idx]?.isMarkedX;
          return gridData?.[idx]?.isMarkedX && !gridData?.[idx]?.isStarred;
        });
        if (done) resolvedStep = lessonStep + 1;
      }
    }
    if (resolvedStep !== lessonStep) setLessonStep(resolvedStep);
  }, [doubleGuideActive, lessonStep, gridData, isComplete, level, doubleTeachingStepCount, lessonContract, doubleGuidanceActions]);

  useEffect(() => {
    if (!activeGuide?.autoAdvanceMs) return;
    const timer = setTimeout(() => {
      if (ruleGuideActive) guidanceActions?.advanceRules();
    }, activeGuide.autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [activeGuide, guidanceActions, ruleGuideActive]);

  useEffect(() => {
    if (!isFirstGuideLevel || !replayPending || replayBlocked) return;
    guidanceActions?.beginReplay();
  }, [guidanceActions, isFirstGuideLevel, replayBlocked, replayPending]);

  useEffect(() => {
    if (!isFirstDoubleGuideLevel || !doubleReplayPending || doubleReplayBlocked) return;
    setLessonStep(1);
  }, [doubleReplayBlocked, doubleReplayPending, isFirstDoubleGuideLevel]);

  useEffect(() => {
    if (!activeGuide) return;
    setGuideNudge(false);
    guideMissCountRef.current = 0;
  }, [activeGuide, lessonStep, guideKind, operationStep, ruleStep]);

  useEffect(() => {
    if (storedDoubleDeduction?.bindingKey === activeDoubleDeduction?.bindingKey
        && storedDoubleDeduction?.contextKey === activeDoubleDeduction?.contextKey) {
      return;
    }
    setStoredDoubleDeduction(activeDoubleDeduction);
  }, [activeDoubleDeduction, storedDoubleDeduction]);

  useEffect(() => {
    const previous = previousCountsRef.current;
    if (!previous || previous.inputKey !== inputKey) {
      previousCountsRef.current = {
        inputKey,
        rows: [...rowCounts],
        cols: [...colCounts],
        regions: [...regionCounts],
      };
      pendingStarGestureRef.current = null;
      return;
    }

    const pending = pendingStarGestureRef.current;
    previousCountsRef.current = {
      inputKey,
      rows: [...rowCounts],
      cols: [...colCounts],
      regions: [...regionCounts],
    };
    if (!pending) return;
    pendingStarGestureRef.current = null;

    const starIdx = pending.starredIndexes?.[0] ?? pending.startIdx;
    if (state.hasConflicts) return;

    if (!isComplete) {
      setPlaceEffects(prev => new Set(prev).add(starIdx));
      clearTimeout(placeTimersRef.current.get(starIdx));
      placeTimersRef.current.set(starIdx, setTimeout(() => {
        setPlaceEffects(prev => {
          const next = new Set(prev);
          next.delete(starIdx);
          return next;
        });
        placeTimersRef.current.delete(starIdx);
      }, 240));
    }

    if (pending.wasOperationGesture) {
      guidanceActions?.completeOperation();
      return;
    }

    if (!guidance?.rules?.completed || isComplete) return;
    const nextSatisfied = createEmptySatisfiedUnits();
    rowCounts.forEach((count, idx) => {
      if ((previous.rows[idx] ?? 0) < quota && count === quota) nextSatisfied.rows.add(idx);
    });
    colCounts.forEach((count, idx) => {
      if ((previous.cols[idx] ?? 0) < quota && count === quota) nextSatisfied.cols.add(idx);
    });
    regionCounts.forEach((count, idx) => {
      if ((previous.regions[idx] ?? 0) < quota && count === quota) nextSatisfied.regions.add(idx);
    });
    if (nextSatisfied.rows.size || nextSatisfied.cols.size || nextSatisfied.regions.size) {
      setSatisfiedUnits(nextSatisfied);
      clearTimeout(satisfactionTimerRef.current);
      satisfactionTimerRef.current = setTimeout(() => {
        setSatisfiedUnits(createEmptySatisfiedUnits());
      }, 320);
    }
  }, [colCounts, guidance?.rules?.completed, guidanceActions, inputKey, isComplete, quota, regionCounts, rowCounts, state.hasConflicts]);

  useEffect(() => () => {
    exitTimersRef.current.forEach(timer => clearTimeout(timer));
    placeTimersRef.current.forEach(timer => clearTimeout(timer));
    clearTimeout(satisfactionTimerRef.current);
    clearTimeout(guideNudgeTimerRef.current);
    clearTimeout(feedbackTimerRef.current);
  }, []);

  // Trigger completion animation once per solve
  useEffect(() => {
    if (isComplete && !hasPlayedCompleteRef.current) {
      hasPlayedCompleteRef.current = true;
    }
    if (!isComplete) {
      hasPlayedCompleteRef.current = false;
    }
  }, [isComplete]);

  const starIconSize = N <= 5 ? 31 : N <= 6 ? 29 : N <= 8 ? 27 : 25;

  const activeConflictLabels = CONFLICT_LABELS
    .filter(([type]) => state.conflictTypes?.[type])
    .map(([, label]) => label);

  const conflictSummary = [
    ...(state.countExceeded ? ['星点过多'] : []),
    ...activeConflictLabels,
  ].join(' · ');

  const activeRuleCounts = useMemo(() => {
    const statusIdx = activeStatusIdx ?? hoveredIdx;
    if (statusIdx === null) return null;
    const row = Math.floor(statusIdx / N);
    const col = statusIdx % N;
    const regionId = regions[statusIdx];
    return {
      row: rowCounts[row] ?? 0,
      col: colCounts[col] ?? 0,
      region: regionCounts[regionId] ?? 0,
    };
  }, [activeStatusIdx, hoveredIdx, N, regions, rowCounts, colCounts, regionCounts]);

  const visibleRuleCounts = activeRuleCounts || { row: '—', col: '—', region: '—' };

  useEffect(() => {
    if (!showIntroHint) return;
    const timer = setTimeout(() => setShowIntroHint(false), 3200);
    return () => clearTimeout(timer);
  }, [showIntroHint]);

  const handleDoubleGuideButton = useCallback(() => {
    if (!doubleRuleGuide) return;
    if (doubleRuleGuide.type === 'explain') {
      setLessonStep(s => s + 1);
      return;
    }
    if (doubleRuleGuide.type === 'autonomous' && doubleRuleGuide.hintAvailable) {
      setDoubleHintState(previous => {
        const level = previous.bindingKey === doubleRuleGuide.hintBindingKey
          ? previous.level
          : 0;
        return {
          bindingKey: doubleRuleGuide.hintBindingKey,
          level: Math.min(doubleRuleGuide.hintMaxLevel, level + 1),
        };
      });
      return;
    }
    if (doubleRuleGuide.delayedHint && doubleRuleGuide.hintCanAdvance) {
      setDoubleHintState({
        bindingKey: doubleRuleGuide.hintBindingKey,
        level: 1,
      });
    }
  }, [doubleRuleGuide]);

  const handleDoubleHintTimerStatus = useCallback((status) => {
    setDoubleHintTimerStatus(status);
  }, []);
  const doubleHintTimerKey = doubleRuleGuide?.usesDelayedHint
    ? doubleRuleGuide.hintBindingKey
    : null;
  const activeDoubleHintTimerStatus = doubleHintTimerStatus?.timerKey === doubleHintTimerKey
    ? doubleHintTimerStatus
    : { remainingSeconds: 10, unlocked: false };
  const doubleGuideCopy = doubleRuleGuide?.type === 'autonomous'
    && doubleRuleGuide.hintLevel === 0
    && doubleRuleGuide.hintCanAdvance
    ? activeDoubleHintTimerStatus.unlocked
      ? '提示已解锁，也可以继续自己判断。'
      : `先自己观察，${activeDoubleHintTimerStatus.remainingSeconds} 秒后可查看提示。`
    : doubleRuleGuide?.copy;

  return (
    <div
      className={`starline-board-shell ${doubleGuideActive || doubleReplayBlocked ? 'has-double-guide' : ''}`}
      data-board-size={N}
    >
      {(doubleGuideActive || doubleReplayBlocked) ? (
        <div
          className="starline-double-guide-card"
          data-guide-step={lessonStep}
          data-guide-type={doubleRuleGuide?.type || 'blocked'}
          data-hint-level={doubleRuleGuide?.hintLevel || 0}
          data-hint-mode={doubleRuleGuide?.hintMode || 'none'}
          data-deduction-id={doubleRuleGuide?.deductionId || ''}
          data-deduction-board-hash={doubleRuleGuide?.deductionBoardStateHash || ''}
          data-deduction-action={doubleRuleGuide?.deductionAction || ''}
          data-deduction-targets={(doubleRuleGuide?.deductionTargetCells || []).join(',')}
          data-testid="star-line-double-guide-card"
        >
          <span data-testid="star-line-guide-copy">
            {doubleReplayBlocked
              ? '请重新开始双星第 1 关后查看推理教学。'
              : guideNudge ? '试试高亮位置。' : doubleGuideCopy}
          </span>
          {feedbackMessage && (
            <span data-testid="star-line-feedback-message" className="starline-feedback-complete" style={{ fontSize: '0.8rem', color: 'var(--sl-warn-rgb, #f6a64d)' }}>
              {feedbackMessage}
            </span>
          )}
          {!doubleReplayBlocked && doubleRuleGuide?.type === 'explain' && (
            <button
              type="button"
              className="starline-double-guide-card__button"
              data-testid="star-line-double-guide-action"
              onClick={handleDoubleGuideButton}
            >
              {doubleRuleGuide.buttonLabel || '继续'}
            </button>
          )}
          {!doubleReplayBlocked && doubleRuleGuide?.usesDelayedHint
            && doubleRuleGuide.hintCanAdvance && (
            <DelayedDoubleGuideHintButton
              key={doubleHintTimerKey}
              timerKey={doubleHintTimerKey}
              onClick={handleDoubleGuideButton}
              onStatusChange={handleDoubleHintTimerStatus}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
          {!doubleReplayBlocked && doubleRuleGuide?.usesDelayedHint
            && !doubleRuleGuide.hintCanAdvance && (
            <button
              type="button"
              className="starline-double-guide-card__button is-delayed-hint"
              data-testid="star-line-double-guide-action"
              disabled
            >
              {!doubleRuleGuide.hintAvailable
                ? '暂无提示'
                : doubleRuleGuide.type === 'autonomous'
                  ? '已显示位置'
                  : '已查看提示'}
            </button>
          )}
        </div>
      ) : (activeGuide || replayBlocked) ? (
        <div
          className="starline-guide-copy"
          data-guide-kind={guideKind || 'blocked'}
          data-guide-step={guideKind === 'operation'
            ? operationStep
            : guideKind === 'double-rule'
              ? lessonStep
              : ruleStep}
          data-testid="star-line-guide-copy"
        >
          {replayBlocked
            ? '请重新开始单星第 1 关后查看操作教学。'
            : guideNudge ? '试试高亮位置。' : activeGuide.copy}
          {activeGuide?.autoAdvanceMs && <span className="starline-guide-continue-label">马上继续</span>}
        </div>
      ) : showIntroHint && (
        <div className="starline-intro-hint">
          {getStarLineRuleCopy(quota)}
        </div>
      )}
      <div className="starline-play-area lg:!w-full lg:!max-w-full lg:!flex-col">
        <div className={`starline-paper-board ${isComplete ? 'is-complete' : ''}`} data-testid="star-line-board-container">
          <svg
            className="starline-region-layer starline-region-layer--fills"
            viewBox={`0 0 ${N} ${N}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            data-testid="star-line-region-fills"
          >
            {regions.map((regionId, idx) => (
              <rect
                key={idx}
                x={idx % N}
                y={Math.floor(idx / N)}
                width="1"
                height="1"
                style={{ '--sl-region-rgb': `var(--sl-region-${regionId % 12}-rgb)` }}
              />
            ))}
          </svg>
          <div
            className={`starline-grid ${isDragging ? 'is-dragging' : ''}`}
            style={{
              gridTemplateColumns: `repeat(${N}, 1fr)`,
              gridTemplateRows: `repeat(${N}, 1fr)`,
            }}
            {...gridPointerHandlers}
            data-input-state={isDragging ? 'dragging' : pendingTapIdx !== null ? 'pending' : 'idle'}
            data-guide-kind={guideKind || 'none'}
            data-guide-step={guideKind === 'operation'
              ? operationStep
              : guideKind === 'double-rule'
                ? lessonStep
                : ruleGuideActive
                  ? ruleStep
                  : 0}
            data-testid="star-line-board"
          >
            {gridData.map((cell, idx) => {
              const rid = cell.regionId;
              const row = Math.floor(idx / N);
              const col = idx % N;
              const isConflict = conflictCells.has(idx);
              const isStarred = Boolean(cell.isStarred);
              const isGuideTarget = guideTargetSet.has(idx);
              const isGuideObservation = guideObservationSet.has(idx);
              const isGuideEvidence = guideEvidenceSet.has(idx);
              const isGuideAction = guideActionSet.has(idx);
              const isGuideDimmed = guideTargetSet.size > 0 && !isGuideTarget;
              const isAssistDimmed = highlightCells.size > 0 && !highlightCells.has(idx);
              const isAssistHighlighted = highlightCells.has(idx);
              const isSatisfied = satisfiedUnits.rows.has(row)
                || satisfiedUnits.cols.has(col)
                || satisfiedUnits.regions.has(rid);
              const exitMark = exitMarks.get(idx);
              const hasPlaceEffect = placeEffects.has(idx);

              return (
                <div
                  key={idx}
                  data-testid={`star-line-cell-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`starline-cell ${isStarred ? 'is-starred' : cell.isMarkedX ? 'is-marked-x' : 'is-empty'} ${isGuideDimmed ? 'is-guide-dimmed is-dimmed' : ''} ${isAssistDimmed ? 'is-assist-dimmed is-dimmed' : ''} ${isAssistHighlighted ? 'is-assist-highlighted' : ''} ${isGuideTarget ? 'is-guide-target' : ''} ${isGuideObservation ? 'is-guide-observation' : ''} ${isGuideEvidence ? 'is-guide-evidence' : ''} ${isGuideAction ? 'is-guide-action' : ''} ${isSatisfied ? 'is-unit-satisfied' : ''} ${isConflict ? 'is-conflict' : ''} ${pressedIdx === idx || pendingTapIdx === idx ? 'is-input-pending' : ''}`}
                  data-unit-satisfied={isSatisfied ? 'true' : 'false'}
                  data-cell-state={isStarred ? 'starred' : cell.isMarkedX ? 'marked-x' : 'empty'}
                >
                  {isStarred && (
                    <>
                      {isComplete && !isConflict && <span className="starline-complete-radial" aria-hidden="true" />}
                      {hasPlaceEffect && !isConflict && <span className="starline-place-halo" aria-hidden="true" data-testid={`star-line-place-halo-${idx}`} />}
                      <Star
                        className={`starline-star-icon ${hasPlaceEffect ? 'is-placing' : ''} ${isConflict ? 'is-conflict' : ''} ${isComplete ? 'is-complete' : ''}`}
                        size={starIconSize}
                        strokeWidth={1.8}
                        style={{
                          '--sl-star-delay': `${getStarLineStarDelay(starOrder.get(idx) ?? 0, completionTiming)}ms`,
                          '--sl-star-pulse-duration': `${completionTiming.starPulseDuration}ms`,
                        }}
                        data-testid={`star-line-star-${idx}`}
                      />
                    </>
                  )}
                  {!isStarred && cell.isMarkedX && (
                    <StarLineX
                      className="starline-x"
                      size={Math.round(starIconSize * 0.84)}
                      data-testid={`star-line-x-${idx}`}
                    />
                  )}
                  {exitMark?.kind === 'x' && (
                    <StarLineX
                      className={`starline-x-exit is-${exitMark.source}`}
                      size={Math.round(starIconSize * 0.84)}
                      data-testid={`star-line-x-exit-${idx}`}
                    />
                  )}
                  {exitMark?.kind === 'star' && (
                    <Star
                      className="starline-star-exit"
                      size={starIconSize}
                      strokeWidth={1.8}
                      data-testid={`star-line-star-exit-${idx}`}
                    />
                  )}
                  {/* Solution overlay — dev playtest */}
                  {showSolution && solutionCells.includes(idx) && !isStarred && (
                    <span
                      className="starline-solution-dot"
                      data-testid={`star-line-solution-${idx}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <svg
            className="starline-region-layer starline-region-layer--outline"
            viewBox={`0 0 ${N} ${N}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            data-testid="star-line-region-outline"
          >
            <path d={regionBoundaryPath} vectorEffect="non-scaling-stroke" />
          </svg>
          {activeGuide && (
            <StarLineGuideOverlay
              boardSize={N}
              targetCells={activeGuide.targets}
              path={activeGuide.path || []}
              demoPaths={activeGuide.demoPaths || []}
              pointerTarget={activeGuide.pointer ?? activeGuide.targets[0]}
              pointerTargets={activeGuide.pointerTargets || []}
              gesture={activeGuide.gesture}
              showDemo={activeGuide.gesture !== undefined && pressedIdx === null}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
        </div>

        <div className="starline-feedback-slot" data-testid="star-line-feedback" aria-live="polite">
          {state.hasConflicts ? (
            <span className="starline-conflict-summary" data-testid="star-line-conflict-summary">{`${conflictSummary}冲突`}</span>
          ) : isComplete ? (
            <span className="starline-feedback-complete" data-testid="star-line-complete-status">星阵已完成</span>
          ) : (
            <div className={`starline-rule-feedback ${activeRuleCounts ? 'has-active-cell' : 'is-idle'}`} data-testid="star-line-rule-feedback">
              {[
                ['row', '行', visibleRuleCounts.row],
                ['col', '列', visibleRuleCounts.col],
                ['region', '星域', visibleRuleCounts.region],
              ].map(([key, label, count]) => (
                <span key={key} className="starline-rule-feedback__item" data-testid={`star-line-rule-${key}`}>
                  {label} <strong className={count === quota ? 'is-full' : ''}>{count}/{quota}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="starline-toolbar" aria-label="星线谜阵工具栏">
          <div className="starline-assist-row">
            <button
              type="button"
              tabIndex={-1}
              className={`starline-assist-button ${showAssistHighlight ? 'is-active' : ''}`}
              aria-pressed={showAssistHighlight}
              data-testid="star-line-assist-toggle"
              onClick={() => setShowAssistHighlight(v => !v)}
            >
              <Sparkles size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>辅助高亮</span>
              <span className="starline-assist-button__state" aria-hidden="true">{showAssistHighlight ? '已开启' : ''}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="starline-undo-button"
              disabled={!canUndo || isComplete || guideBlocksInput || doubleGuideLocksUndo}
              title={doubleGuideLocksUndo || guideBlocksInput ? '教学进行中暂不可撤销' : isComplete ? '通关后无法撤销' : canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
              data-testid="star-line-undo-button"
              onClick={() => undoLast?.()}
            >
              <Undo2 size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>撤销</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
