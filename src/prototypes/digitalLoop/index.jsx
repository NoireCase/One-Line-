// P4B 数字环线 Spike · 原型装配层（集中调用点）
// App 对原型只有一个调用点：<DigitalLoopPrototypeHost />。
// 正式代码不得 import 原型目录内的其他模块。

import DigitalLoopPrototype from './DigitalLoopPrototype.jsx';

/**
 * 集中式 DEV-only prototype host。
 * 由 App 在 ?prototype=digital-loop 且 DEV/playtest 门槛命中时渲染。
 */
export function DigitalLoopPrototypeHost() {
  return <DigitalLoopPrototype />;
}

// React.lazy 需要 default export（命名导出保留给旧静态引用路径）
export default DigitalLoopPrototypeHost;
