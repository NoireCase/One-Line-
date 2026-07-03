import { AnimatePresence } from 'motion/react';
import { motion as Motion } from 'motion/react';
import GameHud from './GameHud.jsx';
import GameBoard from './GameBoard.jsx';
import GameActions from './GameActions.jsx';
import GameStatusLayer from './GameStatusLayer.jsx';
import DevCandidateInfoPanel from '../DevCandidateInfoPanel.jsx';

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
  onDevLose
}) {
  const gameContent = (
    <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 pt-1 pb-0 relative">

      <AnimatePresence>
        {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
          <Motion.div
            className="w-full max-w-md mb-1.5 text-center"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.28 }}
          >
            <span className="text-[11px] text-slate-500/80 tracking-wide">
              从 1 开始按顺序连接，用路径位置推理隐藏数字
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

      <div className="mt-3 text-center w-full max-w-md text-slate-500 font-medium text-xs">
        {portalRun ? (
          <span>路径 <span className="text-slate-300 text-base font-semibold">{path.length}</span> / {N * N} · 目标 <span className="text-violet-300/70 font-semibold">{N * N - 1}</span> 步</span>
        ) : (
          <span>路径 <span className="text-slate-300 text-base font-semibold">{path.length}</span> / {N * N}</span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="app-shell flex flex-col font-sans overflow-hidden relative"
      data-testid="game-view"
      style={isDevCandidate ? { height: '100dvh' } : undefined}
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
        pathLength={path.length}
        N={N}
        prefersReducedMotion={prefersReducedMotion}
        onBack={onBack}
        onRestart={onRestart}
        isDevCandidate={isDevCandidate}
        devLabel={devLabel}
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
        gameContent
      )}

      {!isDevCandidate && !isHidden && <GameActions items={items} onUseItem={onUseItem} />}

      <GameStatusLayer
        status={status}
        levelReport={levelReport}
        levelIdx={levelIdx}
        maxLevelCount={maxLevelCount}
        hasNextLevel={hasNextLevel}
        isHidden={isHidden}
        isPortal={playMode === 'portalClassic'}
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
