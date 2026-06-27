import {
  ClassicPathMark,
  DiagonalPathMark,
  HiddenPathMark,
  PortalCollectMark,
  PortalPathMark
} from './PuzzleMarks.jsx';

export const getModeStyle = (modeId) => {
  if (modeId === 'classic') {
    return {
      art: ClassicPathMark,
      eyebrow: '基础旅程',
      subtitle: '顺着数字，把整张棋盘连成一条路。',
      accent: 'text-[#9bd0c3]',
      selected: 'puzzle-mode-selected puzzle-mode-classic',
      progress: 'progress-classic',
    };
  }

  if (modeId === 'diagonal') {
    return {
      art: DiagonalPathMark,
      eyebrow: '斜向规则',
      subtitle: '加入斜向连接，路线规划更灵活。',
      accent: 'text-[#88cde3]',
      selected: 'puzzle-mode-selected puzzle-mode-diagonal',
      progress: 'progress-diagonal',
    };
  }

  if (modeId === 'hidden') {
    return {
      art: HiddenPathMark,
      eyebrow: '推理挑战',
      subtitle: '只给关键数字，推完整路线。',
      accent: 'text-[#e0a870]',
      selected: 'puzzle-mode-selected puzzle-mode-hidden',
      progress: 'progress-hidden',
    };
  }

  if (modeId === 'portalClassic') {
    return {
      art: PortalPathMark,
      eyebrow: '旧传送门',
      subtitle: '穿过传送门，完成一条不断开的路径。',
      accent: 'text-[#c0afe2]',
      selected: 'puzzle-mode-selected puzzle-mode-portal',
      progress: 'progress-portal',
    };
  }

  return {
    art: PortalCollectMark,
    eyebrow: '金币目标',
    subtitle: '吃完所有金币，通过传送门抵达终点。步数越少，评价越高。',
    accent: 'text-[#e4c56f]',
    selected: 'puzzle-mode-selected puzzle-mode-collect',
    progress: 'progress-collect',
  };
};

export const getCurrentLevelClass = (modeId) => {
  if (modeId === 'classic') {
    return 'level-current level-current-classic border-[#71aa9d]/90 bg-[#1f3b35] hover:bg-[#254740]';
  }
  if (modeId === 'diagonal') {
    return 'level-current level-current-diagonal border-[#75bed2]/90 bg-[#1d3440] hover:bg-[#233f4c]';
  }
  if (modeId === 'hidden') {
    return 'level-current level-current-hidden border-[#d4855e]/90 bg-[#332018] hover:bg-[#3d281e]';
  }
  if (modeId === 'portalCollect') {
    return 'level-current level-current-collect border-[#d0b05e]/90 bg-[#342b27] hover:bg-[#40332b]';
  }
  return 'level-current level-current-portal border-[#9e87ca]/90 bg-[#2b2440] hover:bg-[#33294b]';
};

export const getCurrentStatusClass = (modeId) => {
  if (modeId === 'classic') return 'text-[#c9e8df]';
  if (modeId === 'diagonal') return 'text-[#c6e9f2]';
  if (modeId === 'hidden') return 'text-[#f5c0a0]';
  if (modeId === 'portalCollect') return 'text-[#ead38b]';
  return 'text-[#d1c2ec]';
};
