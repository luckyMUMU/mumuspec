# Delta Spec: Agent 上下文对齐（PRD 对齐）

分析见 `review/spec-agent-integration-analysis-2026-09-08.md`。

## Requirement: 渐进式披露通道同构

`mumuspec context` 是 agent 获取规范上下文的主通道，文本输出与 JSON 输出必须同构。

### SHALL

- `mumuspec context <path>` 文本输出 SHALL 渲染每一层的 `prd.md` 与 `tech.md` 需求块，与 `--json` 通道的 layers 数据同构。
- 根层（level 0）SHALL 额外加载 `spec.md`——Root spec.md 是全局 charter（跨模块全局规则），与 prd.md / tech.md 共存是规范要求。

### SHALL NOT

- 模块层 `spec.md` SHALL NOT 在 `tech.md` 存在时被加载（模块层 spec.md 仅为 tech.md 的遗留回退）。
- context 文本通道 SHALL NOT 只渲染遗留字段（`spec` / `design`）而遗漏 `prd` / `tech`。

### Enforcement

- ENF-1: enforced-strong(单元测试：根层 prd+tech+spec 共存时三者均加载，根 charter 红线进入 prohibitions)
- ENF-2: enforced-strong(单元测试：模块层 tech 存在时 spec 不加载)
- ENF-3: enforced-weak(context 实跑断言：输出行数 > 50 且含 SHALL 段落)

## Requirement: AGENTS.md 规范链摘要粒度

分发层要求 AGENTS.md 含「规范链摘要」，同时禁止内联全量规范上下文。

### SHALL

- 规范链摘要 SHALL 包含结构信息（层级 / scope / 已加载文档类型 / SHALL 条数 / SHALL NOT 条数）。
- 摘要 SHALL 包含当前路径适用红线（prohibitions）全文——红线已含父层继承，是 agent 最需遵守且最易踩的约束。
- 摘要 SHALL 指明完整约束正文的渐进式加载入口（MCP `get_spec_context` / `mumuspec context`）。
- init 与 install 两条生成链路 SHALL 均传入 specContext。

### SHALL NOT

- 摘要 SHALL NOT 内联 SHALL 全文（正文归 MCP 渐进式加载）。
- 摘要 SHALL NOT 为空——无规范链时 SHALL 输出显式回落提示而非空白。

### Enforcement

- ENF-4: enforced-strong(单元测试：摘要含结构表与红线，且不含 SHALL 正文)
- ENF-5: enforced-strong(容量断言：渲染产物 ≤ 32KiB，E-RULES-001 fail-closed)

## Requirement: CLI 速查单一事实源

CLI-first 要求 agent 知晓全部确定性命令，速查清单不得与命令注册表漂移。

### SHALL

- AGENTS.md「CLI 速查」SHALL 从命令注册表（commander program）现场生成，覆盖全部已注册命令及其子命令。
- CLI-first 核心命令（new / state / guard / decisions / test-cases / tasks / validate / check / drift / capability / finalize-archive / archive）SHALL 置顶。
- CLI 速查生效优先级 SHALL 为：显式参数 > 注册表注入值 > 静态默认。

### SHALL NOT

- SHALL NOT 以硬编码命令清单作为速查唯一来源（必然与实际注册表漂移）。
- install 层 SHALL NOT 反向依赖 cli 层（速查经依赖倒置注入，避免 cli → install → cli 成环）。

### Enforcement

- ENF-6: enforced-strong(单元测试：速查覆盖注册表中全部命令，含子命令展开)
- ENF-7: enforced-strong(单元测试：CLI-first 段先于其余命令段，且优先级解析正确)

## Requirement: 归档 delta 合并净化

归档合并把变更层规范并入目标 scope 时，不得搬运文档元数据与未填写的模板内容。

### SHALL

- 合并前 SHALL 剥离变更层文档的 frontmatter（变更层的 `parent_prd` / `parent_tech` 相对路径在目标位置失效）。
- 合并后目标规范的约束文本 SHALL 为已填写内容。

### SHALL NOT

- SHALL NOT 将变更层 frontmatter 写入目标规范（引发 E-SPEC-010 父文档路径解析失败）。
- SHALL NOT 合并未填写的 init 模板占位符内容（`<Describe …>` / `is maintained at current level`）——违反「禁止约束内容使用无具体含义的占位符文本」。

### Enforcement

- ENF-8: enforced-strong(单元测试：frontmatter 被剥离，parent_* 不出现在合并结果)
- ENF-9: enforced-strong(单元测试：占位符模板返回 null，不合并)
- ENF-10: enforced-weak(实跑断言：`mumuspec validate` 无 E-SPEC-010 且 unverifiable 为 0)

## Requirement: 门禁结论一致性（P1-G5）

`mumuspec check` 与 `mumuspec validate` 共用同一套 E-SPEC-* 诊断码，不得给出相反结论。

### SHALL

- `check` 全量模式（full check）SHALL 并入 `validateAllSpecs` 的 error 级诊断（E-SPEC-* 全族）。
- 并入时 SHALL 按 code+message 去重（E-SPEC-015 等两侧共生产物不重复上报）。

### SHALL NOT

- `check` 的局部模式（--shall / --shall-not / --ponytail）SHALL NOT 并入规范层校验（语义限定）。
- validate 的 warning 级诊断 SHALL NOT 升格进 check 的 error 通道。

### Enforcement

- ENF-11: enforced-strong(单元测试：断链 parent_prd 同时被 validate 与 check 拦截)
- ENF-12: enforced-strong(单元测试：健康项目 check 无误报)

## Requirement: 规范-实现 API 名对齐（P1-G6）

规范正文与文档注释中引用的 API 名必须与实际导出一致——agent 会照规范调用函数。

### SHALL

- 模块规范（prd/tech）与头部注释中的 API 名 SHALL 与模块实际导出一一对应。

### SHALL NOT

- SHALL NOT 为对齐文档而新增无调用方的函数（YAGNI——修文档而非堆代码）。

### Enforcement

- ENF-13: enforced-weak(复核断言：src/feedback 规范与注释中的函数名均可在 manager.ts 导出中找到)

## Requirement: index 全树漂移检测（P1-G7）

index.yaml 是单文件全树注册（children.path 挂 src\mcp 类相对路径），漂移检测必须与之同构。

### SHALL

- `checkIndexDrift` SHALL 全树递归收集含 `.mumuspec` 的目录（排除 node_modules / dot 目录）与 index children 双向对比。
- 新补规范层的模块（src/mcp、src/meta-evolution、src/team）SHALL 采用 V2 格式（doc_type）使严格校验生效。

### SHALL NOT

- index 条目 SHALL NOT 使用绝对路径（相对 projectRoot 的路径才是可移植事实源）。

### Enforcement

- ENF-14: enforced-strong(单元测试：深层未注册目录报 index_drift；node_modules 排除；反向检测失效条目)
- ENF-15: enforced-weak(实跑断言：`mumuspec validate` unverifiable 保持 0 且约束总数增长)
