import {
  ClassicPathMark,
  DiagonalPathMark,
  HiddenPathMark,
  PortalPathMark,
  StarDoubleMark,
  StarLineMark,
  StarSingleMark
} from './PuzzleMarks.jsx';
import { getModeCopy } from '../config/gameExplanations.js';

export const getModeStyle = (modeId) => {
  if (modeId === 'classic') {
    const copy = getModeCopy(modeId);
    return {
      art: ClassicPathMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#9bd0c3]',
      selected: 'puzzle-mode-selected puzzle-mode-classic',
      progress: 'progress-classic',
    };
  }

  if (modeId === 'diagonal') {
    const copy = getModeCopy(modeId);
    return {
      art: DiagonalPathMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#88cde3]',
      selected: 'puzzle-mode-selected puzzle-mode-diagonal',
      progress: 'progress-diagonal',
    };
  }

  if (modeId === 'hidden') {
    const copy = getModeCopy(modeId);
    return {
      art: HiddenPathMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#e0a870]',
      selected: 'puzzle-mode-selected puzzle-mode-hidden',
      progress: 'progress-hidden',
    };
  }

  if (modeId === 'portalClassic') {
    const copy = getModeCopy(modeId);
    return {
      art: PortalPathMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#c0afe2]',
      selected: 'puzzle-mode-selected puzzle-mode-portal',
      progress: 'progress-portal',
    };
  }

  if (modeId === 'starSingle') {
    const copy = getModeCopy(modeId);
    return {
      art: StarSingleMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#b8c2ff]',
      selected: 'puzzle-mode-selected puzzle-mode-starline',
      progress: 'progress-starline',
    };
  }

  if (modeId === 'starDouble') {
    const copy = getModeCopy(modeId);
    return {
      art: StarDoubleMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#f3b0c8]',
      selected: 'puzzle-mode-selected puzzle-mode-starline',
      progress: 'progress-starline',
    };
  }

  if (modeId === 'starLine') {
    const copy = getModeCopy(modeId);
    return {
      art: StarLineMark,
      eyebrow: copy.eyebrow,
      subtitle: copy.description,
      accent: 'text-[#d8bcff]',
      selected: 'puzzle-mode-selected puzzle-mode-starline',
      progress: 'progress-starline',
    };
  }

  return {
    art: PortalPathMark,
    eyebrow: getModeCopy('portalClassic').eyebrow,
    subtitle: getModeCopy('portalClassic').description,
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
