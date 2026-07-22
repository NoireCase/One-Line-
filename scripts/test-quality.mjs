import { spawnSync } from 'node:child_process';

const checks = [
  ['generated 文件安全门禁', ['scripts/check-generated-imports.mjs']],
  ['关卡结构验证', ['scripts/validate-levels.mjs']],
  ['Hidden 唯一解验证', ['scripts/verify-hidden-unique.mjs']],
  ['Star Line 目录多样性验证', ['scripts/test-star-line-catalog-diversity.mjs']],
  ['Star Line 动态开局验证', ['scripts/test-star-line-dynamic-opening.mjs']],
];

for (const [label, args] of checks) {
  console.log(`\n═══ ${label} ═══`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\n✅ 项目关卡质量门禁全部通过');
