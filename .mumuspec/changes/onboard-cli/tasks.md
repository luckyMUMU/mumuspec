# Tasks: onboard-cli (R-0004)

## 测试用例（Design Output — Locked）

| ID | 测试用例 | 类型 | 验证目标 |
|----|---------|------|---------|
| TC-001 | `onboard quickstart --preset frontend` 生成 config.yaml | 单元 | preset 模式跳过问答，生成完整配置 |
| TC-002 | `onboard quickstart --preset backend` guard_layer 正确 | 单元 | backend 模板包含特定 SHALL/SHALL NOT |
| TC-003 | `onboard quickstart --preset fullstack` 正确 | 单元 | fullstack 模板合并前后端约束 |
| TC-004 | 已有 config.yaml 时增量合并 | 单元 | 已有字段保留，新字段追加 |
| TC-005 | 非项目目录退出码非零 | 单元 | 错误处理边界 |
| TC-006 | quickstart 输出包含下一步提示 | 单元 | 展示 `mumuspec new <change-name>` |
| TC-007 | `tutorial` 命令展示欢迎信息 | 单元 | 输出包含路径概览 |
| TC-008 | tutorial 6 阶段引导输出 | 单元 | 每阶段输出非空且有下一步提示 |
| TC-009 | tutorial-change 已存在时跳过创建 | 单元 | 不覆盖已有变更 |
| TC-010 | README Quick Start ≤ 20 行 | 脚本 | 行数验证 |

## 实现任务

### Phase 1: QuickStart Core

- [ ] **T-001**: 扩展 `src/cli/commands/onboard.ts`：新增 `quickstart` 子命令基础骨架（commander 注册 + 选项定义）
- [ ] **T-002**: 实现 `promptQuestions()` — 5 问答收集器（使用 readline/promises 或简单 process.stdin）
- [ ] **T-003**: 实现 `--preset <type>` 快捷路径 — 跳过问答，使用内置模板
- [ ] **T-004**: 实现 `generateProjectConfig(answers)` — 将问答答案 + 模板转换为 config.yaml 结构
- [ ] **T-005**: 实现 `mergeConfig(target, source)` — 增量合并算法（保留已有字段）
- [ ] **T-006**: 实现 `writeConfigFile(root, config)` + 控制台输出摘要
- [ ] **T-007**: 实现 Guard Layer 模板加载（从 `src/core/templates/` YAML 文件读取）

### Phase 2: Templates

- [ ] **T-010**: 创建模板数据结构 `src/core/templates/frontend.json`
- [ ] **T-011**: 创建模板数据结构 `src/core/templates/backend.json`
- [ ] **T-012**: 创建模板数据结构 `src/core/templates/fullstack.json`

每套模板至少包含:
- ≥ 5 条 SHALL
- ≥ 3 条 SHALL NOT
- constraint_strength 默认值 + overrides
- ai.generate_rules 推荐值

### Phase 3: Tutorial Command

- [ ] **T-020**: 新建 `src/cli/commands/tutorial.ts` — 顶层 `tutorial` 命令注册
- [ ] **T-021**: 实现 6 阶段交互式引导逻辑（每阶段输出 + 下一步命令提示）
- [ ] **T-022**: 集成到 `src/cli/index.ts` 或主命令注册入口
- [ ] **T-023**: 实现 `tutorial-change` 存在检测 + 创建逻辑

### Phase 4: README + Polish

- [ ] **T-030**: 优化 README.md Quick Start 区域（≤ 20 行）
- [ ] **T-031**: 添加 Progressive Disclosure 帮助文本控制

### Phase 5: Tests + Guard

- [ ] **T-040**: 编写 `tests/cli/onboard.test.ts`（TC-001 ~ TC-006）
- [ ] **T-041**: 编写 `tests/cli/tutorial.test.ts`（TC-007 ~ TC-009）
- [ ] **T-042**: README 行数验证脚本（TC-010）
- [ ] **T-043**: 运行 `mumuspec guard onboard-cli build`
- [ ] **T-044**: 修复 guard 问题 + 运行测试套件

---

> **Ponytail Notes**: 
> - 问答使用原生 readline 而非外部交互库（YAGNI）
> - 模板使用简单 JSON 文件而非复杂 YAML 数据库（最小可工作）
> - Tutorial 为纯展示引导，不实现复杂状态机（boring over clever）
