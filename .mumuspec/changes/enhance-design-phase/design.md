# Design: enhance-design-phase

## 1. API Contracts

### 1.1 New CLI Commands

#### `mumuspec clarify <change-name> [--max-questions N]`

| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --max-questions | integer | 最大澄清问题数，默认 5 |

**Output:** Creates `clarification-log.md` in change directory.

**Error Conditions:**
- E-CHANGE-001: Change not found
- E-CLARIFY-001: No ambiguous content detected (info, not error)

#### `mumuspec review <change-name> [--format json|md]`

| Field | Type | Description |
|-------|------|-------------|
| change-name | string (positional) | 变更名称，必填 |
| --format | string | 输出格式，默认 md |

**Output:** Creates `design-review.md` in change directory (or JSON to stdout).

**Error Conditions:**
- E-CHANGE-001: Change not found
- E-REVIEW-001: design.md not found

### 1.2 Guard New Error Codes

| Code | Severity | Message Template |
|------|----------|------------------|
| E-DESIGN-009 | ERROR | "Design 文档缺少必填字段: {fields}" |
| E-DESIGN-010 | ERROR | "跨工件不一致: {diff_summary}" |
| E-DESIGN-011 | ERROR | "AI 自审发现 CRITICAL 问题: {issues}" |
| W-DESIGN-001 | WARN | "任务 {task_id} 粒度过大 ({est} min)，建议拆分" |

### 1.3 State Extended Fields

```yaml
# 新增 state 字段
clarify_result:
  completed: boolean
  questions_asked: integer
  questions_answered: integer

review_result:
  completed: boolean
  critical_count: integer
  major_count: integer
  minor_count: integer
```

---

## 2. Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                              CLI                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  mumuspec clarify X                                          │
│       │                                                      │
│       ▼                                                      │
│  ┌──────────────────────┐                                    │
│  │  ClarifyEngine       │                                    │
│  │  - parse proposal.md │                                    │
│  │  - detect ambiguity  │                                    │
│  │  - generate Q's      │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             ▼                                                │
│  ┌──────────────────────┐                                    │
│  │  User Interaction    │                                    │
│  │  (AskQuestion)       │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             ▼                                                │
│  clarification-log.md                                        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  guard --apply checkDesignToBuild                            │
│       │                                                      │
│       ▼                                                      │
│  ┌──────────────────────┐                                    │
│  │  DesignSchemaChecker │──pattern match──► E-DESIGN-009     │
│  │  - load schema       │                                    │
│  │  - check sections    │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
│             ▼                                                │
│  ┌──────────────────────┐                                    │
│  │  ConsistencyChecker  │──diff──► E-DESIGN-010              │
│  │  - proposal vs design│                                    │
│  │  - cognitive vs risk │                                    │
│  └──────────┬───────────┘                                    │
│             │                                                │
             ▼                                                │
│  ┌──────────────────────┐                                    │
│  │  DesignReviewer      │──CRITICAL──► E-DESIGN-011          │
│  │  - 6 dimensions      │                                    │
│  │  - severity levels   │                                    │
│  └──────────────────────┘                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Error Specification

### 3.1 Error Codes

| Code | Type | Trigger Condition | Recovery |
|------|------|-------------------|----------|
| E-DESIGN-009 | Blocking | Design 缺少必填字段 | 补充对应 section |
| E-DESIGN-010 | Blocking | 跨工件不一致 | 对齐差异项 |
| E-DESIGN-011 | Blocking | AI 自审 CRITICAL | 修复关键问题 |
| W-DESIGN-001 | Warning | 任务粒度 > 15 min | 可选：拆分任务 |
| E-CLARIFY-001 | Info | 未检测到模糊点 | 跳过 clarify |

### 3.2 Error Message Format

```
E-DESIGN-009: Design 文档缺少必填字段: API Contracts, Data Flow
  请补充以上 section 后重试。
  使用 `mumuspec guard X design --verbose` 查看匹配规则。
```

---

## 4. Architecture Overview

### 4.1 Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                    CLI (src/cli.ts)                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐     │
│  │ clarify  │  │ review   │  │ guard         │     │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘     │
└───────┼──────────────┼───────────────┼──────────────┘
        │              │               │
        ▼              ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────────┐
│ ClarifyEngine │ │ Design      │ │ PhaseGuard       │
│ (new)         │ │ Reviewer(new)│ │ (extend)         │
└───────┬───────┘ └──────┬──────┘ └────────┬─────────┘
        │                │                  │
        ▼                ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                 Core Utils                           │
│  - YAML parse    - pattern match    - diff           │
└─────────────────────────────────────────────────────┘
```

### 4.2 Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `src/change/clarify.ts` (new) | 解析 proposal，生成澄清问题，写入日志 |
| `src/guard/design-reviewer.ts` (new) | 6 维度设计自审，生成 review 报告 |
| `src/guard/phase-guard.ts` (extend) | E-DESIGN-009/010/011 + W-DESIGN-001 检查 |
| `src/cli.ts` (extend) | clarify / review 子命令路由 |
| `src/core/types.ts` (extend) | 新增 state 字段 |
| `templates/design-schema.yaml` (new) | 设计模板 schema 定义 |

---

## 5. Implementation Layers

### Layer 0: Core Schema & Guard Extension
- **Files:** `src/core/types.ts`, `src/guard/phase-guard.ts`, `templates/design-schema.yaml`
- **Acceptance:**
  - types.ts 新增 clarify_result 和 review_result 字段
  - phase-guard.ts 检测 E-DESIGN-009（section 缺失）
  - Schema 文件定义 required_sections 及 patterns
- **Estimated Effort:** 3-4 hours

### Layer 1: Command Implementation
- **Files:** `src/cli.ts`, `src/change/clarify.ts`, `src/guard/design-reviewer.ts`
- **Acceptance:**
  - `mumuspec clarify X` 正确执行并生成 log
  - `mumuspec review X` 正确执行并生成 review.md
  - 两个命令的错误处理完整
- **Estimated Effort:** 4-6 hours

### Layer 2: Consistency & Granularity
- **Files:** `src/guard/phase-guard.ts`
- **Acceptance:**
  - E-DESIGN-010 跨工件一致性检查通过测试
  - W-DESIGN-001 粒度警告正确触发
  - 旧变更（无新字段）不受影响
- **Estimated Effort:** 2-3 hours

### Layer 3: Test Suite Update
- **Files:** `tests/cli.test.ts`, `tests/design-guard.test.ts` (new)
- **Acceptance:**
  - TC-001 至 TC-008 全部可执行
  - 新增测试不少于 10 个用例
  - 总测试数 >= 192 (现有 182 + 新 10+)
- **Estimated Effort:** 2-3 hours

---

## 6. Constraints Analysis

### 6.1 Performance Requirements
| Metric | Limit | Rationale |
|--------|-------|-----------|
| Guard 增加的延迟 | < 200ms | 不影响 CLI 响应体验 |
| Schema 加载 | < 50ms | 文件通常 < 1KB |
| 一致性检查 | < 500ms | 仅文本匹配，不做 AST |
| clarify 交互 | 无超时限制 | 用户交互场景 |

### 6.2 Compatibility Requirements
- 新增 state 字段必须有默认值（backward compatible）
- 旧变更无新字段时 guard 跳过新增检查
- tweak preset 可用轻量模板

### 6.3 Resource Limits
- 不引入新的 npm 依赖
- 新增源文件不超过 3 个
- Schema 文件纯 YAML，可被外部工具消费

---

## 7. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 模板增加变更负担 | Medium | Medium | tweak 使用轻量模板；提供 `--skip-clarify` |
| AI 自审误报导致频繁阻塞 | Medium | High | 分级处理；仅 CRITICAL 阻塞 |
| 一致性检查性能差 | Low | Low | 限制检查范围；未来增量检查 |
| Schema 匹配规则不稳定 | Low | Medium | Pattern 可配置；提供 `--strict` toggle |
| 旧变更升级困难 | Low | Low | 新增字段全部 optional，默认 false |

---

## 8. Test Strategy

### 8.1 Unit Tests Per Layer
| Layer | Test Focus | Tool |
|-------|------------|------|
| Layer 0 | Schema 解析、Pattern 匹配 | vitest |
| Layer 1 | Command 路由、输出格式 | vitest + exec |
| Layer 2 | Guard 集成、错误码 | vitest |
| Layer 3 | End-to-end 工作流 | CLI test |

### 8.2 Integration Test Scenarios
1. **Full workflow with all 5 improvements:** open → clarify → design → guard → build → verify → archive
2. **Tweak workflow light template:** 确认 tweak preset 只检查 3 个字段
3. **Legacy change backward compat:** 旧变更不受新 guard 影响
4. **Error recovery:** 修复 E-DESIGN-009 后重新 guard 通过

### 8.3 Acceptance Criteria (Measurable)
- 新增 test case >= 10
- Guard 总延迟增加 < 200ms (benchmark)
- 旧 182 测试 0 regression
- 所有 delta-specs 提到的 error code 有对应测试覆盖
