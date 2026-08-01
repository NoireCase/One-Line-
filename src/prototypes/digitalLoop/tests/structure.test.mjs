// P4B 数字环线 Spike · 第一层结构诊断纯函数测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseStructure, STRUCTURES } from '../graph/diagnoseStructure.js';
import { buildVertexDegrees, connectedComponents } from '../graph/edgeGraph.js';
import { DIAGNOSTIC_BOARDS } from '../data/diagnosticBoards.js';

// 独立几何事实：h:(r,c) 端点 (r,c)-(r,c+1)；v:(r,c) 端点 (r,c)-(r+1,c)。
// 下列回归用例的 Edge key 全部人工按冻结坐标推导，不通过待测邻接函数生成。

function blockLoopKeys(r, c) {
  return [
    `h:${r}:${c}`, `h:${r}:${c + 1}`,
    `h:${r + 2}:${c}`, `h:${r + 2}:${c + 1}`,
    `v:${r}:${c}`, `v:${r + 1}:${c}`,
    `v:${r}:${c + 2}`, `v:${r + 1}:${c + 2}`,
  ];
}

test('Empty：无边线', () => {
  const result = diagnoseStructure([], 5);
  assert.equal(result.structure, STRUCTURES.empty);
});

test('Open Chain：开放链', () => {
  const result = diagnoseStructure(['h:2:1', 'h:2:2'], 5);
  assert.equal(result.structure, STRUCTURES.openChain);
});

test('Closed Single Loop：闭合方环', () => {
  const result = diagnoseStructure(blockLoopKeys(1, 1), 5);
  assert.equal(result.structure, STRUCTURES.closedSingleLoop);
  assert.equal(result.detail.edgeCount, 8);
});

test('Branch：顶点 degree ≥ 3', () => {
  const result = diagnoseStructure(['h:2:1', 'h:2:2', 'v:1:2'], 5);
  assert.equal(result.structure, STRUCTURES.branch);
  assert.equal(result.detail.maxDegree, 3);
});

test('Multiple Loops：两个独立闭合环', () => {
  const result = diagnoseStructure([...blockLoopKeys(0, 0), ...blockLoopKeys(3, 3)], 7);
  assert.equal(result.structure, STRUCTURES.multipleLoops);
  assert.equal(result.detail.loopCount, 2);
});

test('Invalid Edge Reference：非法坐标 / 非法格式 / 重复', () => {
  assert.equal(diagnoseStructure(['h:99:0'], 5).structure, STRUCTURES.invalidEdgeReference);
  assert.equal(diagnoseStructure(['x:1:1'], 5).structure, STRUCTURES.invalidEdgeReference);
  assert.equal(diagnoseStructure(['h:2:1', 'h:2:1'], 5).structure, STRUCTURES.invalidEdgeReference);
});

test('excluded 不参与结构判定', () => {
  // 诊断只接收 line keys；场景 7（数字 0 与 excluded）的 excluded 不影响 Empty
  const scene = DIAGNOSTIC_BOARDS.find((board) => board.id === 'clue-zero-excluded');
  assert.ok(scene.excludedKeys.length > 0);
  const result = diagnoseStructure(scene.lineKeys, scene.n);
  assert.equal(result.structure, STRUCTURES.empty, '只有 excluded、没有 line → Empty');
});

test('环+链 归入 Open Chain 并记录组成', () => {
  const result = diagnoseStructure([...blockLoopKeys(0, 0), 'h:4:4'], 7);
  assert.equal(result.structure, STRUCTURES.openChain);
  assert.equal(result.detail.loopCount, 1);
  assert.equal(result.detail.chainCount, 1);
});

test('诊断场景数据：全部 lineKeys 合法且无重复', () => {
  for (const scene of DIAGNOSTIC_BOARDS) {
    const result = diagnoseStructure(scene.lineKeys, scene.n);
    assert.notEqual(
      result.structure,
      STRUCTURES.invalidEdgeReference,
      `场景 ${scene.id} 的 lineKeys 应合法，实际结构=${result.structure}`,
    );
  }
});

// ── 真实几何结构回归（key 人工推导）──

test('几何回归 1：1×1 外边界四边环为 Closed Single Loop，四顶点 degree=2', () => {
  // n=1：h:0:0 (0,0)-(0,1)；h:1:0 (1,0)-(1,1)；v:0:0 (0,0)-(1,0)；v:0:1 (0,1)-(1,1)
  const keys = ['h:0:0', 'h:1:0', 'v:0:0', 'v:0:1'];
  const result = diagnoseStructure(keys, 1);
  assert.equal(result.structure, STRUCTURES.closedSingleLoop);
  const degrees = buildVertexDegrees(keys);
  for (const vertex of ['0:0', '0:1', '1:0', '1:1']) {
    assert.equal(degrees.get(vertex), 2, `顶点 ${vertex} degree 应为 2`);
  }
});

test('几何回归 2：两条连续横边为同一 Open Chain，中间 degree=2 两端 degree=1', () => {
  // h:2:1 (2,1)-(2,2)；h:2:2 (2,2)-(2,3)
  const keys = ['h:2:1', 'h:2:2'];
  const result = diagnoseStructure(keys, 5);
  assert.equal(result.structure, STRUCTURES.openChain);
  const degrees = buildVertexDegrees(keys);
  assert.equal(degrees.get('2:1'), 1);
  assert.equal(degrees.get('2:2'), 2);
  assert.equal(degrees.get('2:3'), 1);
  const { components } = connectedComponents(keys);
  assert.equal(components.length, 1, '两条连续横边属于同一连通分量');
});

test('几何回归 3：横边接竖边直角为同一分量，转角顶点 degree=2', () => {
  // h:2:1 (2,1)-(2,2)；v:2:1 (2,1)-(3,1)：共同顶点 (2,1)
  const keys = ['h:2:1', 'v:2:1'];
  const result = diagnoseStructure(keys, 5);
  assert.equal(result.structure, STRUCTURES.openChain);
  const degrees = buildVertexDegrees(keys);
  assert.equal(degrees.get('2:1'), 2, '转角顶点 (2,1) degree=2');
  const { components } = connectedComponents(keys);
  assert.equal(components.length, 1, '横边与竖边通过同一顶点进入同一连通分量');
  assert.equal(components[0].edgeCount, 2);
});

test('几何回归 4：T 型三边为 Branch，中心顶点 degree=3', () => {
  // h:2:1 (2,1)-(2,2)；h:2:2 (2,2)-(2,3)；v:1:2 (1,2)-(2,2)：共同顶点 (2,2)
  const keys = ['h:2:1', 'h:2:2', 'v:1:2'];
  const result = diagnoseStructure(keys, 5);
  assert.equal(result.structure, STRUCTURES.branch);
  const degrees = buildVertexDegrees(keys);
  assert.equal(degrees.get('2:2'), 3);
});

test('几何回归 5：两个空间分离的 1×1 环为 Multiple Loops', () => {
  // n=4。环1：(0,0)-(1,1) 块 = h:0:0, h:1:0, v:0:0, v:0:1
  // 环2：(2,2)-(3,3) 块 = h:2:2, h:3:2, v:2:2, v:2:3
  // 两环顶点集 {0,0),(0,1),(1,0),(1,1)} 与 {(2,2),(2,3),(3,2),(3,3)} 无交集（空间分离）
  const keys = ['h:0:0', 'h:1:0', 'v:0:0', 'v:0:1', 'h:2:2', 'h:3:2', 'v:2:2', 'v:2:3'];
  const result = diagnoseStructure(keys, 4);
  assert.equal(result.structure, STRUCTURES.multipleLoops);
  assert.equal(result.detail.loopCount, 2);
});

test('几何回归 6：共享顶点双环（8 字形）为 Branch，共享顶点 degree=4', () => {
  // 左环 (1,1)-(2,1)-(2,2)-(1,2)：h:1:1, v:1:1, h:2:1, v:1:2
  // 右环 (2,2)-(3,2)-(3,3)-(2,3)：h:2:2, v:2:2, h:3:2, v:2:3
  // 两环共享顶点 (2,2)：h:1:1 右端、v:1:2 下端、h:2:2 左端、v:2:2 上端 → degree 4。
  // 即使两环各自闭合，共享顶点 degree ≥ 3 必须优先归为 Branch（非 Multiple Loops）。
  const keys = ['h:1:1', 'v:1:1', 'h:2:1', 'v:1:2', 'h:2:2', 'v:2:2', 'h:3:2', 'v:2:3'];
  const result = diagnoseStructure(keys, 5);
  assert.equal(result.structure, STRUCTURES.branch, '8 字形共享顶点双环归为 Branch');
  const degrees = buildVertexDegrees(keys);
  assert.equal(degrees.get('2:2'), 4, '共享顶点 (2,2) degree=4');
  assert.equal(result.detail.maxDegree, 4);
});
