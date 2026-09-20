# L3 迁移清单：behavior-gate 候选逐条核验（engine-consolidation）

## 已挂 gate（2 条，strong 2→4）

| 约束 | gate_ref | 核验 |
|---|---|---|
| 禁止以 `--force` 越过 E-SPEC-015（…） | error-code:E-SPEC-015 | 注册✓ 语料命中✓ |
| 禁止无 enforcement 声明的 SHALL 进入强制面（…） | error-code:E-SPEC-004 | 注册✓ 语料命中✓ |

## 其余 legacy 兜底条目归类（本轮不动，逐条理由）

| # | 源 | 条目（截断） | 归类 | 不动理由 |
|---|---|---|---|---|
| 1 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | Module-level `spec.md` SHALL NOT coexist w… | A-共存 | 由 checkFileCoexistence 真实执行，无注册码承载其违规发射（E-GUARD-003 无语料声明），挂 gate 会悬空——后续为共存门禁建语料再挂 |
| 2 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | Module-level `design.md` SHALL NOT coexist… | A-共存 | 由 checkFileCoexistence 真实执行，无注册码承载其违规发射（E-GUARD-003 无语料声明），挂 gate 会悬空——后续为共存门禁建语料再挂 |
| 3 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | The loader SHALL NOT load both `prd.md` an… | B-系统行为 | 豁免路径零执行是已知假强制面；unit-test 指针形态明确不引入（YAGNI），待后续变更以语料探针覆盖 loader/init 行为后挂 corpus gate |
| 4 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | The system SHALL NOT enforce `single_activ… | B-系统行为 | 豁免路径零执行是已知假强制面；unit-test 指针形态明确不引入（YAGNI），待后续变更以语料探针覆盖 loader/init 行为后挂 corpus gate |
| 5 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | The system SHALL NOT create changes in roo… | B-系统行为 | 豁免路径零执行是已知假强制面；unit-test 指针形态明确不引入（YAGNI），待后续变更以语料探针覆盖 loader/init 行为后挂 corpus gate |
| 6 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | Init SHALL NOT overwrite existing `prd.md`… | B-系统行为 | 豁免路径零执行是已知假强制面；unit-test 指针形态明确不引入（YAGNI），待后续变更以语料探针覆盖 loader/init 行为后挂 corpus gate |
| 7 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | 禁止在文档中写对齐来源、修改说明类元注释（如"（与 XX 对齐）"、"本次更新了…"… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 8 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 将通用能力标记为专用工具以提高"重要性"（分层基于风险等级）… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 9 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 跳过专用工具的前置校验（即使"看起来没问题"）… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 10 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 通过 `mumuspec capability` 查询不到的层级… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 11 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | 禁止自动注解产出与约束语义无关的通道映射（如"样板代码→no-side-effect… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 12 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | 禁止手工编辑由 CLI 管理的审计与状态工件：decisions.md 追加（须 `… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 13 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | 禁止以自由文本形式声明"设计完备"（完备性结论必须可由工件状态推导）。… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 14 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | 禁止生成 `.cursorrules` 与 `.windsurfrules`（遗留格… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 15 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 将约束密度直接判定为"好/坏"质量分（密度是调节信号，质量判定归… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 16 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净（兜底是防线，不是许可）。… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 17 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 保留未被注册的命令模块，也不得以"有测试覆盖"代替"已接线"。… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 18 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 以"技能不可用"为由静默跳过高风险门禁。… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 19 | D:\Code\AI-coding\mumuspec\.mumuspec\spec.md | SHALL NOT 让 `--installed` 列表在 `--project-o… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |
| 20 | D:\Code\AI-coding\mumuspec\demo\.mumuspec\spec.md | SHALL NOT 使用 JSX 语法（CDN 模式下使用 `htm` tagged… | C-其他 | 无可核验 code/corpus 指针证据；语义为流程行为约束→保持 weak 或后续变更评估 |

合计在册 20 条（本轮挂 gate 2 条后余 20 条分类如上）。
