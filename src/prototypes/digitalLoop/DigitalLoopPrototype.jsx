// P4B 数字环线 Spike · 原型主组件（桌面最终输入收敛）
// 输入映射：左键 line（点击/拖动，可覆盖 X）；右键单击单个 X；Shift+左键点击/拖动连续 X。
// 状态、undo、预览、Hit/Stroke Debug、快捷键集中在此；不进入正式 registry / 存储。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DigitalLoopBoard from './components/DigitalLoopBoard.jsx';
import DiagnosticPanel from './components/DiagnosticPanel.jsx';
import { DIAGNOSTIC_BOARDS } from './data/diagnosticBoards.js';
import { EDGE_STATES } from './input/edgeState.js';
import { computeBoardLayout, toBoardLocal, displayCellSizePx, HIT_PARAMS } from './input/edgeGeometry.js';
import { createGestureController, DRAG_MOVE_THRESHOLD_CSS } from './input/gestureMachine.js';
import { UndoStack } from './input/undoTransactions.js';
import { listAllEdgeKeys, parseEdgeKey } from './input/edgeCoordinates.js';
import { hitTestEdgeDetailed } from './input/hitTesting.js';
import { diagnoseStructure } from './graph/diagnoseStructure.js';
import { evaluateClues } from './loopy/clueEvaluation.js';
import { evaluateCompletion } from './loopy/evaluateCompletion.js';

function boardFromScene(scene) {
  const edges = {};
  for (const key of scene.lineKeys || []) edges[key] = EDGE_STATES.line;
  for (const key of scene.excludedKeys || []) edges[key] = EDGE_STATES.excluded;
  return edges;
}

const MAX_STROKE_EVENTS = 40;

export default function DigitalLoopPrototype() {
  const [sceneId, setSceneId] = useState(DIAGNOSTIC_BOARDS[0].id);
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === sceneId) ?? DIAGNOSTIC_BOARDS[0];

  const [edges, setEdges] = useState(() => boardFromScene(scene));
  const [undoCount, setUndoCount] = useState(0);
  const [gestureStatus, setGestureStatus] = useState('idle');
  const [lastGesture, setLastGesture] = useState(null);
  const [pointerType, setPointerType] = useState('unknown');
  const [svgSize, setSvgSize] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [hover, setHover] = useState(null);
  const [pressChannel, setPressChannel] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [tracePoints, setTracePoints] = useState([]);
  const [strokeEvents, setStrokeEvents] = useState([]);

  const svgRef = useRef(null);
  const undoStackRef = useRef(new UndoStack());
  const controllerRef = useRef(null);
  const edgesRef = useRef(edges);
  const strokeEventsRef = useRef([]);

  const layout = useMemo(() => computeBoardLayout(scene.n), [scene.n]);
  const allEdgeKeys = useMemo(() => listAllEdgeKeys(scene.n), [scene.n]);

  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // 测量 SVG 实际显示尺寸
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

  const pushStrokeEvent = useCallback((event) => {
    if (!debugMode) return;
    strokeEventsRef.current = [...strokeEventsRef.current, { ...event, at: strokeEventsRef.current.length }];
    if (strokeEventsRef.current.length > MAX_STROKE_EVENTS) {
      strokeEventsRef.current = strokeEventsRef.current.slice(strokeEventsRef.current.length - MAX_STROKE_EVENTS);
    }
    setStrokeEvents(strokeEventsRef.current);
  }, [debugMode]);

  // 手势控制器（随棋盘尺寸重建）
  useEffect(() => {
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
      onStrokeDebug: pushStrokeEvent,
      // 右键 pending 被取消（超阈值 / cancel / blur / Esc）：清空 X 预览通道
      onRightClickCancelled: () => setPressChannel(null),
    });
    controllerRef.current = controller;
    return () => { controllerRef.current = null; };
  }, [layout, pushStrokeEvent]);

  // 场景切换 / Reset
  const resetToScene = useCallback((nextScene) => {
    setEdges(boardFromScene(nextScene));
    undoStackRef.current.clear();
    setUndoCount(0);
    setLastGesture(null);
    setGestureStatus('idle');
    setHover(null);
    setPressChannel(null);
    setTracePoints([]);
    strokeEventsRef.current = [];
    setStrokeEvents([]);
  }, []);

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

  // 清理视觉反馈（pointerup / cancel / blur / Esc 后）
  const clearFeedback = useCallback(() => {
    setHover(null);
    setPressChannel(null);
    setTracePoints([]);
  }, []);

  // 快捷键：Cmd/Ctrl+Z 撤销；Esc 取消活跃手势
  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((event.metaKey || event.ctrlKey) && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        const activeId = controllerRef.current?.getActivePointerId();
        const cancelled = controllerRef.current?.cancelActive() ?? false;
        if (activeId !== null && activeId !== undefined) {
          try { svgRef.current?.releasePointerCapture?.(activeId); } catch { /* capture 可能已释放 */ }
        }
        clearFeedback();
        if (cancelled) setGestureStatus('canceled');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearFeedback]);

  // Pointer 事件 → board-local + screen → 手势控制器
  const toLocalFromEvent = (event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? toBoardLocal({ x: event.clientX, y: event.clientY }, rect, layout) : null;
  };

  const collectDebug = (event, local, detail, button, channel) => {
    if (!debugMode) return;
    const parsed = detail?.nearest ? parseEdgeKey(detail.nearest.key) : null;
    setDebugInfo({
      clientX: Math.round(event.clientX),
      clientY: Math.round(event.clientY),
      boardX: local ? Number(local.x.toFixed(1)) : null,
      boardY: local ? Number(local.y.toFixed(1)) : null,
      nearestH: detail?.nearestH ? { key: detail.nearestH.key, dist: Number(detail.nearestH.dist.toFixed(2)) } : null,
      nearestV: detail?.nearestV ? { key: detail.nearestV.key, dist: Number(detail.nearestV.dist.toFixed(2)) } : null,
      ambiguous: detail?.ambiguous ?? false,
      selectedKey: detail?.nearest && !detail.ambiguous && detail.nearest.dist <= layout.corridorHalfWidth
        ? detail.nearest.key : null,
      selectedState: detail?.nearest && !detail.ambiguous && detail.nearest.dist <= layout.corridorHalfWidth
        ? (edgesRef.current[detail.nearest.key] ?? 'undecided') : null,
      button,
      channel,
      orientation: parsed?.orientation ?? null,
      row: parsed?.row ?? null,
      col: parsed?.col ?? null,
    });
  };

  const handlePointerDown = (event) => {
    const local = toLocalFromEvent(event);
    if (!local) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerType(event.pointerType);
    setGestureStatus('down');
    const channel = event.button === 2 || (event.button === 0 && event.shiftKey) ? 'excluded' : 'line';
    setPressChannel(channel);
    const detail = hitTestEdgeDetailed(local, layout);
    collectDebug(event, local, detail, event.button, channel);
    controllerRef.current?.handlePointerDown({
      local,
      screen: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
      button: event.button,
      shiftKey: event.shiftKey,
    });
  };

  const handlePointerMove = (event) => {
    const local = toLocalFromEvent(event);
    if (!local) return;
    const detail = hitTestEdgeDetailed(local, layout);
    const gestureActive = controllerRef.current?.isGestureActive() ?? false;

    if (!gestureActive) {
      // 中性 Hover：同一 hit 事实源（歧义时未选中）
      const key = detail.nearest && !detail.ambiguous && detail.nearest.dist <= layout.corridorHalfWidth
        ? detail.nearest.key
        : null;
      setHover({ key, ambiguous: detail.ambiguous, local });
    }

    if (debugMode) {
      setTracePoints((prev) => {
        const next = [...prev, { x: Number(local.x.toFixed(1)), y: Number(local.y.toFixed(1)) }];
        return next.length > 40 ? next.slice(next.length - 40) : next;
      });
    }
    collectDebug(event, local, detail, event.buttons === 2 ? 2 : 0, pressChannel);
    controllerRef.current?.handlePointerMove({
      local,
      screen: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
    });
  };

  const handlePointerUp = (event) => {
    clearFeedback();
    controllerRef.current?.handlePointerUp({ pointerId: event.pointerId });
  };

  const handlePointerCancel = (event) => {
    clearFeedback();
    controllerRef.current?.handlePointerCancel({ pointerId: event.pointerId });
  };

  // 窗口失焦等效 pointercancel
  useEffect(() => {
    const onBlur = () => {
      clearFeedback();
      controllerRef.current?.handleWindowBlur();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [clearFeedback]);

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
    { label: 'tie ε px', value: cellPx ? (HIT_PARAMS.tieEpsilon * cellPx / layout.cellSize).toFixed(1) : '—' },
    { label: 'drag thr px', value: `${DRAG_MOVE_THRESHOLD_CSS} css` },
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

  const strokeLabel = (event) => {
    switch (event.type) {
      case 'down': return `down ${event.key} ${event.channel}`;
      case 'drag-start': return 'drag-start';
      case 'hit': return `hit ${event.key} ${event.from}→${event.to}`;
      case 'rejected': return `rejected [${(event.candidates || []).join(',') || 'none'}]`;
      case 'right-click-pending': return `right-click pending ${event.key}`;
      case 'right-click-cancelled': return 'right-click cancelled (moved)';
      case 'right-click-commit': return `right-click commit ${event.key} ${event.from}→${event.to}`;
      default: return event.type;
    }
  };

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
          <div className="w-full max-w-[560px] rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-[11px] text-slate-400" data-testid="desktop-instructions">
            <p><span className="text-emerald-400 font-semibold">左键</span> 点击或拖动：添加 / 删除线（线可覆盖 X）</p>
            <p><span className="text-indigo-400 font-semibold">右键单击</span>：添加 / 删除单个 X（X 不覆盖线）</p>
            <p><span className="text-indigo-400 font-semibold">Shift + 左键</span> 点击或拖动：添加 / 删除 X</p>
            <p className="text-slate-500">快捷键：Cmd/Ctrl+Z 撤销 · Esc 取消当前笔划 · Mac 触摸板可使用双指点按标记单个 X；连续标记请使用 Shift + 左键拖动</p>
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
              onDragStart={(event) => event.preventDefault()}
              hover={hover}
              pressChannel={pressChannel}
              debugMode={debugMode}
              debugInfo={debugInfo}
              tracePoints={tracePoints}
            />
          </div>
          <p className="text-[11px] text-slate-500">{scene.description}</p>
        </div>

        <aside className="w-full lg:w-72 shrink-0 bg-slate-900/60 border border-slate-800 rounded-lg p-3 overflow-y-auto" data-testid="diagnostic-aside">
          <h2 className="text-xs font-semibold text-slate-400 mb-2">诊断信息</h2>
          <DiagnosticPanel items={diagItems} />
          {!sceneHasClues && (
            <div className="mt-3 text-xs text-slate-500" data-testid="no-clue-note">
              无数字线索，本场景仅验证结构；无数字时不得判定完成
            </div>
          )}
          {completion?.complete && (
            <div className="mt-3 text-xs text-emerald-400 font-semibold" data-testid="completion-banner">
              诊断完成（单环 ∧ 全部数字线索满足）——仅原型状态，不触发正式完成流程
            </div>
          )}

          <details className="mt-4" data-testid="dev-debug-section">
            <summary className="text-xs font-semibold text-slate-400 cursor-pointer select-none">
              DEV Debug：Hit / Stroke Debug 与参数
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="debug-toggle"
                  checked={debugMode}
                  onChange={(event) => {
                    setDebugMode(event.target.checked);
                    if (!event.target.checked) {
                      setDebugInfo(null);
                      setTracePoints([]);
                      strokeEventsRef.current = [];
                      setStrokeEvents([]);
                    }
                  }}
                />
                Hit / Stroke Debug
              </label>
              <p className="text-[10px] text-slate-600">
                桌面输入映射：左键线（点击/拖动）、右键单击单个 X、Shift+左键点击/拖动 X；右键拖动不作为正式输入（secondary drag 可能被系统或浏览器扩展占用）。移动端按平台政策整体暂缓（方案 C 不运行）。
              </p>
            </div>
          </details>

          {debugMode && debugInfo && (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono" data-testid="hit-debug-panel">
              {[
                ['client', `${debugInfo.clientX}, ${debugInfo.clientY}`],
                ['board', debugInfo.boardX !== null ? `${debugInfo.boardX}, ${debugInfo.boardY}` : '—'],
                ['nearest H', debugInfo.nearestH ? `${debugInfo.nearestH.key} @${debugInfo.nearestH.dist}` : '—'],
                ['nearest V', debugInfo.nearestV ? `${debugInfo.nearestV.key} @${debugInfo.nearestV.dist}` : '—'],
                ['ambiguity', debugInfo.ambiguous ? 'TIE' : 'clear'],
                ['selected', debugInfo.selectedKey ?? '—'],
                ['state', debugInfo.selectedState ?? '—'],
                ['button', String(debugInfo.button)],
                ['channel', debugInfo.channel ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-1">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-right text-slate-300" data-testid={`hitdbg-${label.replace(/\s/g, '-')}`}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {debugMode && strokeEvents.length > 0 && (
            <div className="mt-3 text-[10px] font-mono" data-testid="stroke-debug-panel">
              <h3 className="text-slate-500 mb-1">Stroke Debug（最近 {strokeEvents.length} 条）</h3>
              <ul className="space-y-0.5">
                {strokeEvents.slice(-12).map((event) => (
                  <li key={`${event.at}-${event.key ?? ''}-${strokeEvents.indexOf(event)}`} className="text-slate-300">
                    {strokeLabel(event)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
