/**
 * 集中管理所有 DOM 选择器常量。
 * 优先级：data-testid > role + name > visible text > className
 */

export const S = {
  // ── 首页 ──
  home: {
    view: '[data-testid="home-view"]',
    title: '[data-testid="home-title"]',
    oneLineCard: '[data-testid="home-one-line-card"]',
    oneLineTitle: '[data-testid="home-one-line-title"]',
    starLineCard: '[data-testid="home-star-line-card"]',
    starLineTitle: '[data-testid="home-star-line-title"]',
    startButton: '[data-testid="home-start-button"]',
    starLineButton: '[data-testid="home-star-line-button"]',
    continueButton: '[data-testid="home-continue-button"]',
    settingsButtonSecondary: '[data-testid="home-settings-button-secondary"]',
    settingsButton: '[data-testid="home-settings-button"]',
  },

  // ── 设置面板 ──
  settings: {
    panel: '[data-testid="settings-panel"]',
    title: '[data-testid="settings-panel-title"]',
    closeButton: '[data-testid="settings-close-button"]',
    confirmButton: '[data-testid="settings-confirm-button"]',
  },

  // ── 谜题书（关卡列表页） ──
  puzzleBook: {
    page: '[data-testid="puzzle-book-page"]',
    backButton: '[data-testid="puzzle-book-back-button"]',
    title: '[data-testid="puzzle-book-title"]',
    levelSection: '[data-testid="level-section"]',
    progressText: '[data-testid="level-progress-text"]',
    levelGrid: '[data-testid="level-grid"]',
    levelGridWrap: '[data-testid="level-grid-wrap"]',
    difficultyName: '[data-testid="level-difficulty-name"]',
    leftArrow: '[data-testid="difficulty-arrow-left"]',
    rightArrow: '[data-testid="difficulty-arrow-right"]',
    replayDialog: '[data-testid="level-replay-dialog"]',
    replayConfirm: '[data-testid="level-replay-confirm"]',
    replayCancel: '[data-testid="level-replay-cancel"]',
    replayEntry: '[data-testid="level-completion-replay-entry"]',
    replayHint: '[data-testid="level-completion-replay-hint"]',
    anyTile: '[data-testid^="level-tile-"]',
    // Legacy selectors retained only for tests that explicitly assert the old structure is gone.
    cta: '[data-testid="level-select-cta"]',
    chapterToggle: (key) => `[data-testid="level-chapter-toggle-${key}"]`,
    chapter: (key) => `[data-testid="level-chapter-${key}"]`,
    // 函数选择器: levelTile('classic-0')
    levelTile: (key) => `[data-testid="level-tile-${key}"]`,
  },

  // ── 模式切换 ──
  modeSwitcher: {
    section: '[data-testid="mode-switcher"]',
    // 函数选择器: modeCard('classic')
    modeCard: (modeId) => `[data-testid="mode-card-${modeId}"]`,
  },

  // ── 游戏界面 ──
  game: {
    view: '[data-testid="game-view"]',
    board: '.board-sketch',
    cell: (idx) => `[data-testid="cell-${idx}"]`,
    pathHead: '.path-head',
    pathVisited: '.path-visited',
    backButton: '[data-testid="back-button"]',
    restartButton: '[data-testid="restart-button"]',
    modeLabel: '[data-testid="mode-label"]',
    timer: '[data-testid="timer"]',
    score: '[data-testid="score"]',
    stepCountHud: '[data-testid="step-count-hud"]',
    stepCountValue: '[data-testid="step-count-value"]',
    toast: '[data-testid="game-toast"]',
  },

  // ── 退出提示 ──
  exitPrompt: {
    panel: '[data-testid="exit-prompt"]',
    saveAndExit: '[data-testid="save-and-exit-button"]',
    abandonAndExit: '[data-testid="abandon-and-exit-button"]',
    continueGame: '[data-testid="continue-game-button"]',
  },

  // ── 胜利面板 ──
  win: {
    panel: '[data-testid="win-panel"]',
    backdrop: '[data-testid="win-panel-backdrop"]',
    title: '[data-testid="win-title"]',
    stars: '[data-testid="win-stars"]',
    nextButton: '[data-testid="win-next-button"]',
    retryButton: '[data-testid="win-retry-button"]',
    backButton: '[data-testid="win-back-button"]',
  },

  // ── 失败面板 ──
  lose: {
    panel: '[data-testid="lose-panel"]',
    title: '[data-testid="lose-title"]',
    reviveButton: '[data-testid="lose-revive-button"]',
    restartButton: '[data-testid="lose-restart-button"]',
    backButton: '[data-testid="lose-back-button"]',
  },

  // ── 购买弹窗 ──
  purchase: {
    prompt: '[data-testid="purchase-prompt"]',
    confirmButton: '[data-testid="purchase-confirm-button"]',
    cancelButton: '[data-testid="purchase-cancel-button"]',
  },

  // ── 胜利面板解锁徽标 ──
  unlock: {
    badge: '[data-testid="win-unlock-badge"]',
  },
};
