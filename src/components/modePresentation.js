import {
  ClassicPathMark,
  DiagonalPathMark,
  HiddenPathMark,
  PortalPathMark,
  StarLineMark
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
      eyebrow: '八向路径',
      subtitle: '斜向也能走，路线规划更灵活。',
      accent: 'text-[#88cde3]',
      selected: 'puzzle-mode-selected puzzle-mode-diagonal',
      progress: 'progress-diagonal',
    };
  }

  if (modeId === 'hidden') {
    return {
      art: HiddenPathMark,
      eyebrow: '极简推理',
      subtitle: '只给关键数字，推完整路线。',
      accent: 'text-[#e0a870]',
      selected: 'puzzle-mode-selected puzzle-mode-hidden',
      progress: 'progress-hidden',
    };
  }

  if (modeId === 'portalClassic') {
    return {
      art: PortalPathMark,
      eyebrow: '空间传送',
      subtitle: '穿过传送门，路径在另一端继续。',
      accent: 'text-[#c0afe2]',
      selected: 'puzzle-mode-selected puzzle-mode-portal',
      progress: 'progress-portal',
    };
  }

  if (modeId === 'starLine' || modeId === 'starSingle' || modeId === 'starDouble') {
    return {
      art: StarLineMark,
      eyebrow: modeId === 'starDouble' ? '双星推理' : '单星推理',
      subtitle: modeId === 'starDouble'
        ? '每行、每列、每片星域各放2个星点；星点不能相邻。'
        : '每行、每列、每片星域各放1个星点；星点不能相邻。',
      accent: 'text-[#d8bcff]',
      selected: 'puzzle-mode-selected puzzle-mode-starline',
      progress: 'progress-starline',
    };
  }

  return {
    art: PortalPathMark,
    eyebrow: '空间传送',
    subtitle: '穿过传送门，路径在另一端继续。',
    accent: 'text-[#c0afe2]',
    selected: 'puzzle-mode-selected puzzle-mode-portal',
    progress: 'progress-portal',
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
  if (modeId === 'starLine' || modeId === 'starSingle' || modeId === 'starDouble') {
    return 'level-current level-current-starline border-[#c9a8ff]/90 bg-[#2f2544] hover:bg-[#382b50]';
  }
  return 'level-current level-current-portal border-[#9e87ca]/90 bg-[#2b2440] hover:bg-[#33294b]';
};

export const getCurrentStatusClass = (modeId) => {
  if (modeId === 'classic') return 'text-[#c9e8df]';
  if (modeId === 'diagonal') return 'text-[#c6e9f2]';
  if (modeId === 'hidden') return 'text-[#f5c0a0]';
  if (modeId === 'starLine' || modeId === 'starSingle' || modeId === 'starDouble') return 'text-[#e4ccff]';
  return 'text-[#d1c2ec]';
};
