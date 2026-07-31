// P4B 数字环线 Spike · 原型主组件
// 状态、undo、方案切换与诊断计算集中在此；不进入正式 registry / 存储。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DigitalLoopBoard from './components/DigitalLoopBoard.jsx';
import InputSchemeControls from './components/InputSchemeControls.jsx';
import DiagnosticPanel from './components/DiagnosticPanel.jsx';
import { DIAGNOSTIC_BOARDS } from './data/diagnosticBoards.js';
import { EDGE_STATES } from './input/edgeState.js';
import { computeBoardLayout, toBoardLocal, displayCellSizePx, HIT_PARAMS } from './input/edgeGeometry.js';
import { createGestureController, SCHEMES, LONG_PRESS_MS } from './input/gestureMachine.js';
import { UndoStack } from './input/undoTransactions.js';
import { listAllEdgeKeys } from './input/edgeCoordinates.js';
import { diagnoseStructure } from './graph/diagnoseStructure.js';
import { evaluateClues } from './loopy/clueEvaluation.js';
import { evaluateCompletion } from './loopy/evaluateCompletion.js';

function boardFromScene(scene) {
  const edges = {};
  for (const key of scene.lineKeys || []) edges[key] = EDGE_STATES.line;
  for (const key of scene.excludedKeys || []) edges[key] = EDGE_STATES.excluded;
  return edges;
}

export default function DigitalLoopPrototype() {
  const [sceneId, setSceneId] = useState(DIAGNOSTIC_BOARDS[0].id);
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === sceneId) ?? DIAGNOSTIC_BOARDS[0];

  const [edges, setEdges] = useState(() => boardFromScene(scene));
  const [scheme, setScheme] = useState(SCHEMES.a);
  const [tool, setTool] = useState('line');
  const [undoCount, setUndoCount] = useState(0);
  const [gestureStatus, setGestureStatus] = useState('idle');
  const [lastGesture, setLastGesture] = useState(null);
  const [pointerType, setPointerType] = useState('unknown');
  const [svgSize, setSvgSize] = useState(null);
  const [completion, setCompletion] = useState(null);

  const svgRef = useRef(null);
  const undoStackRef = useRef(new UndoStack());
  const longPressTimerRef = useRef(null);
  const controllerRef = useRef(null);
  const edgesRef = useRef(edges);

  const layout = useMemo(() => computeBoardLayout(scene.n), [scene.n]);
  const allEdgeKeys = useMemo(() => listAllEdgeKeys(scene.n), [scene.n]);

  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // 测量 SVG 实际显示尺寸（用于记录 cell 像素边长等）
  useEffect(() => {
    const measure = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) setSvgSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    if (observer && svgRef.current) observer.observe(svgRef.current);
    return () => observer?.disconnect();
  }, [scene.n]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 手势控制器（随棋盘尺寸重建）
  useEffect(() => {
    clearLongPressTimer();
    const controller = createGestureController({
      layout,
      getEdgeState: (key) => edgesRef.current[key] ?? EDGE_STATES.undecided,
      applyChange: (key, _from, to) => {
        setEdges((prev) => ({ ...prev, [key]: to }));
      },
      onGestureCommit: (changes, meta) => {
        undoStackRef.current.push(changes);
        setUndoCount(undoStackRef.current.size);
        setLastGesture({ source: meta?.source ?? 'unknown', changedCount: changes.length });
        setGestureStatus('committed');
      },
      onGestureCancel: () => {
        setGestureStatus('canceled');
      },
      onLongPressArmed: (_key, pointerId) => {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          controllerRef.current?.handleLongPressExpired({ pointerId });
        }, LONG_PRESS_MS);
      },
      onLongPressCancelled: clearLongPressTimer,
      scheme,
      tool,
    });
    controllerRef.current = controller;
    return () => {
      clearLongPressTimer();
      controllerRef.current = null;
    };
  }, [layout, scheme, tool, clearLongPressTimer]);

  // 场景切换 / Reset
  const resetToScene = useCallback((nextScene) => {
    clearLongPressTimer();
    setEdges(boardFromScene(nextScene));
    undoStackRef.current.clear();
    setUndoCount(0);
    setLastGesture(null);
    setGestureStatus('idle');
  }, [clearLongPressTimer]);

  const handleSceneChange = (id) => {
    setSceneId(id);
    const next = DIAGNOSTIC_BOARDS.find((board) => board.id === id) ?? DIAGNOSTIC_BOARDS[0];
    resetToScene(next);
  };

  const handleReset = () => resetToScene(scene);
  const handleUndo = () => {
    const transaction = undoStackRef.current.pop();
    if (!transaction) return;
    setEdges((prev) => {
      const next = { ...prev };
      for (const { key, from } of transaction) next[key] = from;
      return next;
    });
    setUndoCount(undoStackRef.current.size);
    setLastGesture({ source: 'undo', changedCount: transaction.length });
  };

  // Pointer 事件 → board-local → 手势控制器
  const toLocalFromEvent = (event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? toBoardLocal({ x: event.clientX, y: event.clientY }, rect, layout) : null;
  };

  const handlePointerDown = (event) => {
    const local = toLocalFromEvent(event);
    if (!local) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerType(event.pointerType);
    setGestureStatus('down');
    controllerRef.current?.handlePointerDown({
      local,
      pointerId: event.pointerId,
      button: event.button,
    });
  };

  const handlePointerMove = (event) => {
    const local = toLocalFromEvent(event);
    if (!local) return;
    controllerRef.current?.handlePointerMove({ local, pointerId: event.pointerId });
  };

  const handlePointerUp = (event) => {
    controllerRef.current?.handlePointerUp({ pointerId: event.pointerId });
  };

  const handlePointerCancel = (event) => {
    clearLongPressTimer();
    controllerRef.current?.handlePointerCancel({ pointerId: event.pointerId });
  };

  // 窗口失焦等效 pointercancel
  useEffect(() => {
    const onBlur = () => {
      clearLongPressTimer();
      controllerRef.current?.handleWindowBlur();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [clearLongPressTimer]);

  // 两层判定（纯函数，派生状态）
  const lineKeys = useMemo(
    () => Object.entries(edges).filter(([, state]) => state === EDGE_STATES.line).map(([key]) => key),
    [edges],
  );
  const structureResult = useMemo(() => diagnoseStructure(lineKeys, scene.n), [lineKeys, scene.n]);
  const clueResult = useMemo(
    () => evaluateClues(scene.clues, new Set(lineKeys), scene.n),
    [scene.clues, lineKeys, scene.n],
  );
  const sceneHasClues = useMemo(
    () => (scene.clues ?? []).some((row) => row.some((clue) => clue !== null)),
    [scene.clues],
  );

  useEffect(() => {
    setCompletion(evaluateCompletion(structureResult.structure, clueResult));
  }, [structureResult, clueResult]);

  const cellPx = svgSize ? displayCellSizePx({ width: svgSize.width }, layout) : null;

  const diagItems = [
    { label: 'scene', value: scene.id },
    { label: 'board size', value: `${scene.n}×${scene.n}` },
    { label: 'edge total', value: String(allEdgeKeys.length) },
    { label: 'cell px', value: cellPx ? cellPx.toFixed(1) : '—' },
    { label: 'corridor ±px', value: cellPx ? (HIT_PARAMS.corridorHalfWidthRatio * cellPx).toFixed(1) : '—' },
    { label: 'dead zone px', value: cellPx ? (HIT_PARAMS.deadZoneRadiusRatio * cellPx).toFixed(1) : '—' },
    { label: 'scheme', value: scheme },
    { label: 'pointer', value: pointerType },
    { label: 'gesture', value: gestureStatus, tone: gestureStatus === 'canceled' ? 'warn' : 'default' },
    { label: 'last gesture', value: lastGesture ? `${lastGesture.source} ×${lastGesture.changedCount}` : '—' },
    { label: 'undo steps', value: String(undoCount) },
    { label: 'structure', value: structureResult.structure, tone: structureResult.structure === 'Closed Single Loop' ? 'ok' : 'default' },
    { label: 'has clues', value: completion?.hasClues ? 'yes' : 'no', tone: completion?.hasClues ? 'default' : 'warn' },
    { label: 'clues ok', value: `${clueResult.satisfied}/${clueResult.hasClueCount}` },
    { label: 'clues unmet', value: String(clueResult.unmet), tone: clueResult.unmet > 0 ? 'warn' : 'default' },
    { label: 'clues over', value: String(clueResult.over), tone: clueResult.over > 0 ? 'bad' : 'default' },
    { label: 'completion', value: completion?.complete ? 'COMPLETE' : 'not complete', tone: completion?.complete ? 'ok' : 'default' },
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-200 flex flex-col" data-testid="digital-loop-prototype">
      <header className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">P4B · 数字环线 Edge/Input Spike（原型）</h1>
          <p className="text-[11px] text-slate-500">DEV-only 原型 · 不进入正式玩法 · 界环谜阵 / 数字环线 · P4C 尚未裁决</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="scene-select"
            value={sceneId}
            onChange={(event) => handleSceneChange(event.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
          >
            {DIAGNOSTIC_BOARDS.map((board) => (
              <option key={board.id} value={board.id}>{board.name}</option>
            ))}
          </select>
          <button
            type="button"
            data-testid="reset-button"
            onClick={handleReset}
            className="px-3 py-1 rounded text-xs font-medium border border-slate-700 text-slate-300 hover:border-slate-500"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="undo-button"
            onClick={handleUndo}
            className="px-3 py-1 rounded text-xs font-medium border border-slate-700 text-slate-300 hover:border-slate-500"
          >
            Undo ({undoCount})
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 py-3 min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="w-full max-w-[560px]">
            <InputSchemeControls
              scheme={scheme}
              onSchemeChange={setScheme}
              tool={tool}
              onToolChange={setTool}
            />
          </div>
          <div className="w-full max-w-[560px]">
            <DigitalLoopBoard
              layout={layout}
              edges={edges}
              clues={scene.clues}
              allEdgeKeys={allEdgeKeys}
              svgRef={svgRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
          <p className="text-[11px] text-slate-500">{scene.description}</p>
        </div>

        <aside className="w-full lg:w-72 shrink-0 bg-slate-900/60 border border-slate-800 rounded-lg p-3 overflow-y-auto" data-testid="diagnostic-aside">
          <h2 className="text-xs font-semibold text-slate-400 mb-2">诊断信息</h2>
          <DiagnosticPanel items={diagItems} />
          {completion?.complete && (
            <div className="mt-3 text-xs text-emerald-400 font-semibold" data-testid="completion-banner">
              诊断完成（单环 ∧ 全部数字线索满足）——仅原型状态，不触发正式完成流程
            </div>
          )}
          {!sceneHasClues && (
            <div className="mt-3 text-xs text-slate-500" data-testid="no-clue-note">
              无数字线索，本场景仅验证结构；无数字时不得判定完成
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
