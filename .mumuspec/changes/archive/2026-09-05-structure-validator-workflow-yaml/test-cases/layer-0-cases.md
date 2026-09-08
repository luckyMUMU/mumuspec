# Test Cases - Layer 0: structure-validator（.mumuspec/ 目录白名单）

> 测试文件：`tests/structure-validator.test.ts`
> 被测模块：`src/spec/structure-validator.ts`（`validateMumuSpecStructure` 纯函数）
> 错误码：E-SPEC-014（UNDEFINED_MUMUSPEC_FILE）

## Cases

### TC-1: 项目级 workflow.yaml 为合法根级文件（CHG-6/7）
- **可验证性**: enforced-strong
- **Given**: 临时项目根含 `.mumuspec/workflow.yaml`（最小合法 override，version: 1）及 `.mumuspec/spec.md`
- **When**: `validateMumuSpecStructure(projectRoot)`
- **Then**: `errors` 中不包含 code 为 `E-SPEC-014` 且 detail 指向 `workflow.yaml` 的条目；`isValid === true`。

### TC-2: 未定义文件仍被拒绝（白名单不放宽）
- **可验证性**: enforced-strong
- **Given**: 临时项目根含 `.mumuspec/random-junk.md`（不在 DEFINED_FILES 中）
- **When**: `validateMumuSpecStructure(projectRoot)`
- **Then**: 返回 `E-SPEC-014`，detail 指向 `random-junk.md`；`isValid === false`。
