import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion as Motion } from 'motion/react';
import GameHud from './GameHud.jsx';
import GameBoard from './GameBoard.jsx';
import StarLineBoard from './StarLineBoard.jsx';
import GameActions from './GameActions.jsx';
import GameStatusLayer from './GameStatusLayer.jsx';
import DevCandidateInfoPanel from '../DevCandidateInfoPanel.jsx';
import StarLinePlaytestPanel from '../StarLinePlaytestPanel.jsx';
import { getModeCopy } from '../../config/gameExplanations.js';
import { getModeRuntime } from '../../config/gameModes.js';

export default function GameView({
  playMode,
  levelIdx,
  firstLevelHintMode,
  status,
  path,
  N,
  isPathCompleting,
  prefersReducedMotion,
  currentModeName,
  displayLevelNumber,
  timer,
  score,
  comboStreak,
  coins,
  hp,
  portalRun,
  isHidden,
  isStarLine,
  starLineLevel,
  starLineTotalLevels,
  starLineState,
  starLineInputKey,
  starLineCellActions,
  starLineUndoLast,
  starLineCanUndo,
  starLineBeginBatch,
  starLineCommitBatch,
  starLineGuidance,
  starLineGuidanceActions,
  starLineDoubleGuidance,
  starLineDoubleGuidanceActions,
  gridData,
  breakPoints,
  wrongFlash,
  activePortal,
  lastConnectedIndex,
  connectionFeedback,
  items,
  levelReport,
  maxLevelCount,
  hasNextLevel,
  showExitPrompt,
  purchasePrompt,
  containerRef,
  onBack,
  onRestart,
  onNextLevel,
  onWinBack,
  onModeSelect,
  onUseItem,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSaveAndExit,
  onAbandonAndExit,
  onCloseExitPrompt,
  closePurchasePrompt,
  buyPromptItem,
  showToast,
  onRevive,
  onBackToLevels,
  isDevCandidate,
  activeDevCandidate,
  devLabel,
  devCandidateActions,
  onDevWin,
  onDevLose,
  // ── Star Line Playtest Panel ──
  isPlaytestMode = false,
  playtestActions = {},
  playtestShowSolution = false,
  playtestSolutionCells = [],
}) {
  const [showGmPanel, setShowGmPanel] = useState(false);

  // P3B: 模式 → desktop shell class 从 getModeRuntime 推导
  const _rt = isDevCandidate ? null : getModeRuntime(playMode);
  const shellModeClass = isDevCandidate
    ? ''
    : _rt?.capabilities.starLine ? 'game-shell--starline'
    : _rt?.capabilities.hidden ? 'game-shell--hidden'
    : _rt?.capabilities.portal ? 'game-shell--portal'
    : playMode === 'diagonal' ? 'game-shell--diagonal'
    : 'game-shell--classic';

  // 游戏内禁止键盘 Enter/Space/Escape 激活按钮（不影响主页/设置/关卡选择页）
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        if (e.target.closest('[data-testid="game-view"]')) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const hasRestartProgress = isStarLine
    ? gridData.some(cell => cell?.isStarred || cell?.isMarkedX)
    : path.length > 1;
  const firstLevelHint = getModeCopy(playMode).firstHint;

  const gameContent = isStarLine ? (
    <StarLineBoard
      level={starLineLevel}
      gridData={gridData}
      state={starLineState}
      inputKey={starLineInputKey}
      cellActions={starLineCellActions}
      showSolution={playtestShowSolution}
      solutionCells={playtestSolutionCells}
      undoLast={starLineUndoLast}
      canUndo={starLineCanUndo}
      beginBatch={starLineBeginBatch}
      commitBatch={starLineCommitBatch}
      inputBlocked={showExitPrompt || Boolean(purchasePrompt)}
      guidance={starLineGuidance}
      guidanceActions={starLineGuidanceActions}
      doubleGuidance={starLineDoubleGuidance}
      doubleGuidanceActions={starLineDoubleGuidanceActions}
      prefersReducedMotion={prefersReducedMotion}
    />
  ) : (
    <div className="game-board-stage">

      <AnimatePresence>
        {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
          <Motion.div
            className="w-full max-w-md mb-1.5 text-center"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28 }}
          >
            <span className="text-xs text-slate-500/80 tracking-wide">
              {firstLevelHint}
            </span>
          </Motion.div>
        )}
      </AnimatePresence>

      <GameBoard
        gridData={gridData}
        path={path}
        N={N}
        breakPoints={breakPoints}
        isPathCompleting={isPathCompleting}
        wrongFlash={wrongFlash}
        comboStreak={comboStreak}
        activePortal={activePortal}
        lastConnectedIndex={lastConnectedIndex}
        connectionFeedback={connectionFeedback}
        prefersReducedMotion={prefersReducedMotion}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        containerRef={containerRef}
      />

      {/* Hidden 的路径进度由 HUD（hidden-path-hud）持续展示，棋盘下方不再重复 */}
      {!isHidden && (
      <div className="mt-3 text-center w-full max-w-md text-slate-500 font-medium text-xs">
        {portalRun ? (
          <span>路径 <span className="text-slate-300 text-base font-semibold">{path.length}</span> / {N * N} · 目标 <span className="text-violet-300/70 font-semibold">{N * N - 1}</span> 步</span>
        ) : (
          <span>路径 <span className="text-slate-300 text-base font-semibold">{path.length}</span> / {N * N}</span>
        )}
      </div>
      )}
    </div>
  );

  return (
    <div
      className={`app-shell game-shell page-transition flex flex-col font-sans overflow-hidden relative ${shellModeClass}`}
      data-testid="game-view"
    >
      <GameHud
        currentModeName={currentModeName}
        displayLevelNumber={displayLevelNumber}
        timer={timer}
        score={score}
        comboStreak={comboStreak}
        coins={coins}
        hp={hp}
        portalRun={portalRun}
        isHidden={isHidden}
        isStarLine={isStarLine}
        starLinePlacedCount={starLineState?.placedCount || 0}
        starLineTargetCount={starLineState?.targetCount || N}
        pathLength={path.length}
        N={N}
        hpDanger={wrongFlash != null}
        prefersReducedMotion={prefersReducedMotion}
        onBack={onBack}
        onRestart={onRestart}
        hasRestartProgress={hasRestartProgress}
        restartContextKey={`${playMode}:${levelIdx}`}
        status={status}
        isDevCandidate={isDevCandidate}
        devLabel={devLabel}
        isPlaytestMode={isPlaytestMode}
        onOpenGmPanel={() => setShowGmPanel(true)}
        starLineBoardLabel={starLineLevel ? `${starLineLevel.N}×${starLineLevel.N}` : ''}
        starLineQuotaLabel={starLineLevel ? ((starLineLevel.starsPerRow ?? 1) === 1 ? '单星' : '双星') : ''}
      />

      {isDevCandidate ? (
        <div className="flex flex-1 min-h-0 items-stretch overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 pt-1 pb-0 relative min-w-0 min-h-0">
            <GameBoard
              gridData={gridData}
              path={path}
              N={N}
              breakPoints={breakPoints}
              isPathCompleting={isPathCompleting}
              wrongFlash={wrongFlash}
              comboStreak={comboStreak}
              activePortal={activePortal}
              lastConnectedIndex={lastConnectedIndex}
              connectionFeedback={connectionFeedback}
              prefersReducedMotion={prefersReducedMotion}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              containerRef={containerRef}
            />
            <div className="mt-3 text-center w-full max-w-md text-slate-500 font-medium text-xs">
              <span>路径 <span className="text-slate-300 text-base font-semibold">{path.length}</span> / {N * N}</span>
            </div>
          </div>
          <DevCandidateInfoPanel
            candidate={activeDevCandidate}
            actions={devCandidateActions}
          />
        </div>
      ) : (
        <div className="game-stage">{gameContent}</div>
      )}

      {!isDevCandidate && !isHidden && !isStarLine && <GameActions items={items} onUseItem={onUseItem} />}

      {/* Star Line Playtest Panel — right-side drawer */}
      {isStarLine && isPlaytestMode && (
        <StarLinePlaytestPanel
          levelIdx={levelIdx}
          starLineLevel={starLineLevel}
          totalLevels={starLineTotalLevels}
          starLineState={starLineState}
          show={showGmPanel}
          onClose={() => setShowGmPanel(false)}
          showSolution={playtestShowSolution}
          solutionCells={playtestSolutionCells}
          onJumpToLevel={(idx) => {
            playtestActions.onJumpToLevel?.(idx);
            setShowGmPanel(false);
          }}
          onUnlockAll={playtestActions.onUnlockAll}
          onResetLevel={() => {
            playtestActions.onResetLevel?.();
            setShowGmPanel(false);
          }}
          onClearProgress={playtestActions.onClearProgress}
          onToggleSolution={playtestActions.onToggleSolution}
        />
      )}

      <GameStatusLayer
        status={status}
        levelReport={levelReport}
        levelIdx={levelIdx}
        maxLevelCount={maxLevelCount}
        hasNextLevel={hasNextLevel}
        isHidden={isHidden}
        isPortal={playMode === 'portalClassic'}
        isStarLine={isStarLine}
        canSaveStarLineSession={isStarLine && playMode !== 'starLine'}
        onBack={onWinBack}
        onNext={onNextLevel}
        onRetry={onRestart}
        onModeSelect={onModeSelect}
        onRevive={onRevive}
        onRestart={onRestart}
        onBackToLevels={onBackToLevels}
        showExitPrompt={showExitPrompt}
        purchasePrompt={purchasePrompt}
        onSaveAndExit={onSaveAndExit}
        onAbandonAndExit={onAbandonAndExit}
        onCloseExitPrompt={onCloseExitPrompt}
        closePurchasePrompt={closePurchasePrompt}
        buyPromptItem={buyPromptItem}
        showToast={showToast}
        isDevCandidate={isDevCandidate}
        candidate={isDevCandidate && levelReport?.candidate ? levelReport.candidate : null}
        onDevAction={(action) => {
          if (!devCandidateActions || !action) return;
          if (action === 'approved') devCandidateActions.markApproved?.();
          if (action === 'rejected') devCandidateActions.markRejected?.();
          if (action === 'restart') devCandidateActions.restart?.();
          if (action === 'next') devCandidateActions.nextCandidate?.();
          if (action === 'back') devCandidateActions.backToGm?.();
        }}
        onDevWin={onDevWin}
        onDevLose={onDevLose}
      />
    </div>
  );
}
