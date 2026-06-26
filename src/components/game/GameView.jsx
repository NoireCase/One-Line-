import { AnimatePresence } from 'motion/react';
import { motion as Motion } from 'motion/react';
import GameHud from './GameHud.jsx';
import GameBoard from './GameBoard.jsx';
import GameActions from './GameActions.jsx';
import GameStatusLayer from './GameStatusLayer.jsx';

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
  targetSteps,
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
  onBackToLevels
}) {
  return (
    <div className="app-shell flex flex-col font-sans overflow-hidden relative">
      <GameHud
        currentModeName={currentModeName}
        displayLevelNumber={displayLevelNumber}
        timer={timer}
        score={score}
        comboStreak={comboStreak}
        coins={coins}
        hp={hp}
        portalRun={portalRun}
        targetSteps={targetSteps}
        pathLength={path.length}
        prefersReducedMotion={prefersReducedMotion}
        onBack={onBack}
        onRestart={onRestart}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4 pt-2 relative">

        <AnimatePresence>
          {firstLevelHintMode === playMode && levelIdx === 0 && status === 'playing' && (
            <Motion.div
              className="w-full max-w-md mb-2 text-center"
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

        <div className="mt-6 flex justify-between w-full max-w-md px-2 text-slate-500 font-medium text-xs">
          <div>路径长度: <span className="text-slate-300 text-lg font-semibold">{path.length}</span> / {N * N}</div>
          {portalRun ? (
            <div className="text-violet-300/70 font-semibold">目标: {targetSteps} 步</div>
          ) : (
            <div className="text-slate-400">步数: {path.length} / {N * N}</div>
          )}
        </div>
      </div>

      <GameActions items={items} onUseItem={onUseItem} />

      <GameStatusLayer
        status={status}
        levelReport={levelReport}
        levelIdx={levelIdx}
        maxLevelCount={maxLevelCount}
        hasNextLevel={hasNextLevel}
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
      />
    </div>
  );
}
