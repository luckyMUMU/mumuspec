# Verify: drift-delta-preview

## verify_result

pass

## 测试证据

- 单元回归：`vitest run tests/guard` → 20 files / **304 tests passed**（含新增 TC1b：listCarriedConstraintItems 对 constraints + delta-specs 两文件的条目枚举，file/requirement/polarity/text 字段齐备；既有 TC1–TC4 门禁行为零变化）。
- 重构等价性：collectUnchanneledDeltaConstraints 改为 walkConstraintFiles + classifyBlockItem 过滤，行为由既有 4 例回归佐证（单次解析，无第二份解析实现）。
- 构建：`npm run build` 零 TS 错误（首版漏 getChangeDir import 由编译期捕获）。
- 自检三件套：`mumuspec check` exit 0（drift OK）/ `npm run ci:check` ✅（Check 4 双门）/ validate 前轮已验 ✓。
- dogfood：本仓库当前无活跃变更（全部归档），CLI 渲染路径为薄接线（枚举函数已单测覆盖），预览逻辑由 TC1b 数据面直接保障。

## 验收标准对照（proposal Acceptance Criteria）

1. `drift --change` 输出 Delta 预览块（+ 行含 polarity/text/来源）✓（TC1b + 接线）
2. 无携带约束 → （无携带约束）✓（空数组分支）
3. collectUnchanneledDeltaConstraints 行为不变 ✓（304 回归）
4. 三件套不回退 ✓
