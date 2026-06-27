export function getCellClass(cell, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak, isTargetFlash = false) {
  if (cell.isObstacle) return "bg-[#131720] border border-[#2a2f3a]/40 rounded-md cursor-default";
  if (isError) return "bg-rose-500/25 border border-rose-300/75 rounded-md";

  // start / exit — bright border when not yet visited
  if (cell.isStart && !inPath) return "bg-[#1a2a20] border-2 border-[#6bb87e]/70 rounded-md";
  if (cell.isExit && !inPath) return "bg-[#1a201a] border-2 border-[#e4c56f]/70 rounded-md";

  // coin — gold border when not collected
  if (cell.isTarget && !inPath && isTargetFlash) return "bg-[#3a2a12] border-2 border-[#f0cf75] rounded-md coin-attention";
  if (cell.isTarget && !inPath) return "bg-[#2a2418] border-2 border-[#c9a44b]/65 rounded-md";
  // coin — collected (dimmer)
  if (cell.isTarget && inPath) return "bg-[#1c2328]/45 border border-[#54746d]/25 rounded-md";

  if (isHead) {
    if (comboStreak >= 7) return "bg-[#224740] border-2 border-[#b7e7dc] rounded-md";
    if (comboStreak >= 3) return "bg-[#1e3e38] border-2 border-[#9bd8ca] rounded-md";
    return "bg-[#1b3631] border-2 border-[#8acabc] rounded-md";
  }

  // portal — active (highlighted for Portal 1.0 exit-required state)
  if (portalId && (isPortalEntryActive || isPortalExitActive)) {
    return "portal-token bg-violet-500/25 border border-violet-200/75 rounded-md";
  }
  // portal — used (in path, Portal 2.0 or Portal 1.0 after passing through)
  if (portalId && inPath) return "portal-token bg-violet-500/12 border border-violet-300/35 rounded-md";
  // portal — unused
  if (portalId) return "portal-token bg-violet-500/12 border border-violet-300/40 rounded-md";

  if (cell.isHidden && !cell.isRevealed && cell.isHinted) return "bg-blue-500/20 border border-blue-300/60 rounded-md";
  if (cell.isHidden && !cell.isRevealed) return "bg-[#191f2a] border border-[#424b5a]/65 rounded-md";
  if (inPath) return "bg-[#1c2328]/45 border border-[#54746d]/25 rounded-md";
  return "bg-[#242b38] border border-[#3a4050]/50 rounded-md";
}

export function getCellContent(cell, inPath, portalId, isPortal2 = false) {
  if (cell.isObstacle) return null;
  if (cell.isStart) return "S";
  if (cell.isExit) return "E";
  // coin: bright solid when uncollected, small dim dot when collected
  if (cell.isTarget) return inPath ? "·" : "●";
  if (isPortal2 && portalId) return inPath ? "◆" : "◇";
  // portal: "?" when unused, "P" when used
  if (portalId) return inPath ? "P" : "?";
  if (cell.isExcluded) return null;
  if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? cell.val : "";
  if (cell.val && cell.val !== 0) return cell.val;
  return null;
}

export function getCellTextClass(cell, portalId, isPortal2 = false) {
  if (cell.isObstacle) return "text-transparent";
  if (cell.isStart) return "text-[#6bb87e]";
  if (cell.isExit) return "text-[#e4c56f]";
  // coin: bright gold when uncollected, very dim when collected
  // (inPath check handled in getCellContent — content already different)
  if (cell.isTarget) return "text-[#c9a44b]";
  if (cell.isExcluded) return "text-rose-500";
  if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? "text-[#f7edda]" : "text-transparent";
  if (portalId) return isPortal2 ? "text-violet-200" : "text-[#f7edda]";
  return "text-[#f7edda]";
}
