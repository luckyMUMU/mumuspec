# Design — Distributed Spec V2 (R-0003)

> **变更名**: distributed-spec-v2
> **工作流**: full / phase: build
> **产出阶段**: Build (Step 4 自底向上实现)
> **参考**: roadmap/items/R-0003.md, .mumuspec/temp/designs-archive/distributed-spec-v2.md

---

## 1. 系统定位

修复分布式规约体系中的 7 类阻断性不符合项（F1-F7），使 prd.md / tech.md 能够被 Parser / Loader / Validator / Guard 四个层级完整处理。

- **兼容**: 不破坏现有 spec.md 的任何功能
- **增量**: 仅添加新能力，不重构已有代码
- **测试驱动**: 以 +13 e2e tests + 90 已有 spec tests 为验收标准

---

## 2. 顶层架构 (自底向上)

```
Layer 0: types-spec.ts
  ├─ PrdFrontmatter, TechFrontmatter (with parent_prd/parent_tech)
  ├─ PrdFile, TechFile (with requirements 字段)
  └─ SpecContext.prd, .tech, .merged, .inherited_from

Layer 1: parser.ts
  ├─ parsePrdFile / parseTechFile (V2-aware parser)
  ├─ serializePrdFile / serializeTechFile (round-trip)
  └─ parseRequirements (共享解析器)

Layer 2: loader.ts
  ├─ loadSpecContext (自动选择 V1/V2)
  ├─ processInheritance (parent_prd/parent_tech 引用解析)
  ├─ mergeTechFiles / mergePrdFiles (约束合并)
  └─ findAllDistributedSpecDirs (递归发现)

Layer 3: validator.ts
  ├─ validateAllSpecs (覆盖 spec.md + prd.md + tech.md)
  ├─ validatePrdFile (E-SPEC-008/011)
  ├─ validateTechFile (E-SPEC-009/011/012)
  └─ checkParentReferences (E-SPEC-010)

Layer 4: guard/checker.ts
  ├─ collectAllProhibitions (从 spec.md + prd.md + tech.md)
  └─ collectDistributedProhibitions (新增: 递归收集 prd/tech 的 SHALL NOT)

Layer 5: CLI
  └─ 无新命令，通过现有 validate / context / guard 命令暴露
```

---

## 3. API Contracts

### SHALL
- `parsePrdFile(content, path): PrdFile` — V2 格式解析
- `parseTechFile(content, path): TechFile` — V2 格式解析
- `serializePrdFile(prd): string` — 往返序列化
- `serializeTechFile(tech): string` — 往返序列化

### SHALL NOT
- 不修改 parseSpecFile 的签名或返回类型
- 不引入新的 npm 依赖

---

## 4. Data Flow

```
prd.md file
    ↓ readText
    ↓ parsePrdFile → PrdFile { requirements, userScenarios, acceptanceCriteria }
    ↓ loader.processInheritance → merged with parent
    ↓ guard.collectDistributedProhibitions → SHALL NOT constraints

tech.md file
    ↓ readText
    ↓ parseTechFile → TechFile { requirements, architectureDecisions }
    ↓ loader.processInheritance → merged with parent
    ↓ guard.collectDistributedProhibitions → SHALL NOT constraints
```

---

## 5. Error Specification

| Code | Condition | Severity |
|------|-----------|----------|
| E-SPEC-008 | prd.md frontmatter 缺失 required fields | ERROR |
| E-SPEC-009 | tech.md frontmatter 缺失 required fields | ERROR |
| E-SPEC-010 | parent_prd/parent_tech 指向不存在的文件 | ERROR |
| E-SPEC-011 | prd.md/tech.md 无 Requirement 块（格式错误） | WARN |
| E-SPEC-012 | tech.md SHALL 无对应 Enforcement | ERROR |

All parsing errors in collectDistributedProhibitions are **silently skipped** (backward compat).

---

## 6. Constraints Analysis

### Performance
- collectDistributedProhibitions scans all directories recursively during guard check
- For monorepo >1000 directories: latency ~O(N) where N = directory count
- Acceptable for MVP; cache deferred to future

### Compatibility
- Old-format prd.md/tech.md (without `doc_type`) silently skipped
- Only V2 files with `doc_type: prd/tech` frontmatter are parsed

### Security
- No external input flows into parsing (filesystem-only)
- No execution of extracted content

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing spec.md | Backward compat: prd/tech parsing failures are silent skip |
| False negative guard matches | Document that prd/tech SHALL NOT has same heuristic limitations as spec.md |
| Cognitive overhead for users | PRD changes are optional; old projects continue to work unchanged |

---

## 8. Test Strategy

### Layer 0 (Unit)
- tests/spec/parser.test.ts: 31 tests covering parsePrdFile/parseTechFile
- tests/spec/validator.test.ts: 8 tests covering V2 validation
- tests/spec/validator-extra.test.ts: 35 tests for edge cases
- tests/spec/loader.test.ts: 31 tests for loadSpecContext + inheritance

### Layer 1-2 (Integration)
- tests/e2e/distributed-spec.test.ts: 13 tests for full chain (parse → validate → guard)

### Layer 3 (E2E)
- Multilevel project with parent/child prd/tech
- Old format backward compat validation
- Malformed file graceful handling

### Acceptance
- All 277 tests (spec + guard + e2e) pass
- `npm run build` compiles cleanly
- `mumuspec validate` runs on real project without new errors

| 层 | 文件 | 阶段 | 产出 |
|----|------|------|------|
| 0 | types-spec.ts | ✅ done | PrdFile.requirements? 字段 |
| 1 | parser.ts | ✅ done | parsePrdFile/populate requirements |
| 2 | loader.ts | ✅ done | loadSpecContext + inheritance |
| 3 | validator.ts | ✅ done | validatePrdFile/validateTechFile |
| 4 | checker.ts | ✅ done | collectDistributedProhibitions |
| 5 | tests | ✅ done | +13 e2e tests (277 total pass) |

---

## 4. 关键不变量

- 旧 spec.md 格式永久支持 — 任何已有项目不停机
- 新 prd.md/tech.md 只在有 `doc_type: prd/tech` frontmatter 时被解析
- 解析失败静默跳过，不影响其他模块的处理

---

## 5. 验收

- [x] npm run build 无 TS 编译错误
- [x] tests/spec/ (90 tests) pass
- [x] tests/guard/ (174 tests) pass
- [x] tests/e2e/distributed-spec.test.ts (13 tests) pass
- [ ] mumuspec validate 全项目通过（demo 目录有预期错误）
