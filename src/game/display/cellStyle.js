export function getCellClass(cell, inPath, isHead, isError, portalId, isPortalEntryActive, isPortalExitActive, comboStreak) {
  if (isError) return "bg-rose-500/25 border border-rose-300/75 rounded-md";

  if (isHead) {
    if (comboStreak >= 7) return "bg-[#224740] border-2 border-[#b7e7dc] rounded-md";
    if (comboStreak >= 3) return "bg-[#1e3e38] border-2 border-[#9bd8ca] rounded-md";
    return "bg-[#1b3631] border-2 border-[#8acabc] rounded-md";
  }

  // portal — active (highlighted for Portal 1.0 exit-required state)
  if (portalId && (isPortalEntryActive || isPortalExitActive)) {
    return "portal-token bg-violet-500/25 border border-violet-200/75 rounded-md";
  }
  // portal — used after passing through
  if (portalId && inPath) return "portal-token bg-violet-500/12 border border-violet-300/35 rounded-md";
  // portal — unused
  if (portalId) return "portal-token bg-violet-500/12 border border-violet-300/40 rounded-md";

  if (cell.isHidden && !cell.isRevealed && cell.isHinted) return "bg-blue-500/20 border border-blue-300/60 rounded-md";
  if (cell.isHidden && !cell.isRevealed) return "bg-[#191f2a] border border-[#424b5a]/65 rounded-md";
  if (inPath) return "bg-[#1c2328]/45 border border-[#54746d]/25 rounded-md";
  return "bg-[#242b38] border border-[#3a4050]/50 rounded-md";
}

export function getCellContent(cell, inPath, portalId) {
  // portal: "?" when unused, show path number when visited (Portal 1.0)
  if (portalId) return inPath ? (cell.val != null ? cell.val : "·") : "?";
  if (cell.isExcluded) return null;
  if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? cell.val : "";
  if (cell.val && cell.val !== 0) return cell.val;
  return null;
}

export function getCellTextClass(cell, portalId) {
  if (cell.isExcluded) return "text-rose-500";
  if (cell.isHidden && !cell.isRevealed) return cell.isHinted ? "text-[#f7edda]" : "text-transparent";
  if (portalId) return "text-[#f7edda]";
  return "text-[#f7edda]";
}
