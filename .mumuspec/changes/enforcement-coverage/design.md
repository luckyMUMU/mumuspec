# Design: enforcement-coverage

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

两处 enforcement 强化，均限定在归档合并与 validate 展示层，不引入新抽象层、不新增依赖。

## G1: Delta 合并 fail-closed（E-CHANGE-022）

### 现状缺陷（src/change/archive.ts mergeDeltaSpecsToMain）

- L388-393：`-tech.md`/`-prd.md` 目标不存在且根 spec.md 缺失 → `continue` 静默丢弃。
- L405-407：整函数 `try/catch { // Non-fatal }` → 任何 IO 错误静默吞掉。
- 归档报成功但 delta 内容蒸发，违反"引擎执行了动作必须留下可判定事实"。

### 设计

1. **签名变更**：`mergeDeltaSpecsToMain(projectRoot, changeName, changeDir, state?)` →
   返回 `DeltaMergeResult`：
   ```ts
   interface DeltaMergeResult {
     merged: string[];              // 成功合并的目标路径
     skippedIdempotent: string[];   // marker 命中的幂等跳过（可判定、合法）
     unresolved: { file: string; reason: string }[]; // 目标缺失 / IO 失败
   }
   ```
2. **错误处理**：移除整体 catch 吞错；单文件 IO 失败（读写抛错）记入 `unresolved`（reason 含错误消息），不中断其余文件的尝试，但最终整体失败。
3. **归档调用方**（archiveChange 内 L178 调用点）：`unresolved.length > 0` → 抛 `E-CHANGE-022 DELTA_MERGE_INCOMPLETE`（fixSteps 指向修复目标路径或删除无效 delta 文件），归档中断；抛出前 appendAuditLog 记录 unresolved 明细。
4. **错误码**：`E-CHANGE-022` 注册 ERROR_CODES：severity ERROR、forceable: false、fixSteps 三条（补目标 scope 的 tech/prd / 修正 delta 文件命名后缀 / 删除无效 delta 文件重跑归档）。
5. **兼容性**：无 delta-specs 目录或目录为空 → 返回空结果（不报错，tweak 类变更合法）；marker 幂等跳过保持现语义。

### 消费者闭环（先校验器后消费者 / 无死端）

- 生产：mergeDeltaSpecsToMain 结果对象（本变更）。
- 消费：archiveChange 调用点中断逻辑（本变更同批交付）+ 回归测试断言三态。

## G2: 覆盖率清单修复路径提示

### 设计（src/cli/commands/spec.ts validate 输出）

unverifiable_items 逐条按极性追加修复提示行：

- SHALL NOT → `修复路径: (a) mumuspec annotate <scope> 补 frontmatter 注解 | (b) 改写文本使其含 \`词法锚点\`（反引号引用、长度>2） | (c) Requirement 块声明 Enforcement: manual(...)`
- SHALL → `修复路径: Requirement 块声明 Enforcement: manual(...)（SHALL 当前无自动通道）`

提示文本为常量，不做 LLM 生成；JSON 通道在 each item 上增加 `remediation` 字段（同批消费者：文本输出与 JSON 输出共用同一常量源）。

## 不做什么

- 不改四分类判定顺序与通道语义（R1>R2>R3>R4 不动）。
- 不动 composite 收敛权重；不自动改 constraint_strength。
- ci:check 集成 drift 门禁（A2.1）不在本变更范围——drift 命令面语义待单独裁决。

## 测试用例锁定（build 前锁定）

1. TC1 目标缺失 → unresolved 含该文件 + 归档抛 E-CHANGE-022
2. TC2 IO 失败（目标不可读）→ unresolved + E-CHANGE-022
3. TC3 marker 幂等 → skippedIdempotent，无 unresolved，归档成功
4. TC4 正常合并 → merged 含目标路径
5. TC5 无 delta-specs 目录 → 空结果不报错
6. TC6 validate 文本输出含"修复路径"提示；JSON 含 remediation 字段
