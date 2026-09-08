# MumuSpec 全流程自洽性评审 × 生态对标分析

> 日期：2026-09-05 ｜ 基线：v0.19.2-alpha.0 ｜ 范围：端到端流程 + agent coding 生态热点对标

---

## 一、结论摘要

**总体判断：核心流程自洽，且是当前 SDD 赛道中唯一做到"强执行（enforcement-first）"的实现；但外围存在 3 处明显的 dogfooding 滞后与 2 处半实现，命令面膨胀已开始侵蚀自洽性。**

| 维度 | 评价 | 依据 |
|---|---|---|
| 流程闭环 | ✅ 自洽 | proposal→design→build→verify→archive 状态机 + BP 门禁 + fail-closed 完备性门禁，链条完整、错误码体系统一 |
| 生态对齐 | ✅ 领先 | AGENTS.md canonical-first + CLAUDE.md 薄壳桥接与 2026 生态事实标准完全一致（甚至比多数竞品早） |
| 自托管（dogfooding） | ⚠️ 滞后 | 根部 AGENTS.md/CLAUDE.md 仍是旧式全量生成；未启用自家 CHG-7 workflow override |
| 实现完备性 | ⚠️ 两处空壳 | DS-005 任务粒度检查为占位；`spec drift` 与 `spec detect`、`knowledge search` 与 `search2` 重复 |
| 生态定位 | ⭐ 独特 | 竞品（Spec Kit/OpenSpec/BMAD）普遍 "convention/review-gated"，无强制门禁；MumuSpec 的 enforcement 是真差异化 |

---

## 二、全流程自洽性分析

### 2.1 流程闭环（实际实现）

```
init（项目分析→生成 prd/tech/spec/knowledge）
  └─ new（单活跃变更 + scope 子树校验 + 分支创建）
       └─ open ──BP──> design（proposal + decisions 防篡改）
            └─ design ──BP──> build（★完备性门禁：open-questions.yaml 硬错误）
                 └─ build ──BP──> verify（build_layers 全 done + assumptions 门禁）
                      └─ verify ──BP──> archive（verify_result=pass + branch handled）
                           └─ archive/discard（--confirm，终态不可逆）
```

支撑层与主链的咬合关系良好：

- **完备性门禁双轨制**（机械四分类 R1-R4 + LLM 起草 open-questions/assumptions + 人工 decisions.md 锚签收）已落地，且 ENF-3 红线（LLM 自由文本排除在决策路径外）是按构造保证的，不是靠提示词约定——这是同类产品中最严格的设计。
- **CLI 与 MCP 同源**：38 个 MCP 工具直接 import 同一批核心函数，无镜像漂移风险。
- **enforcement-check.mjs** 挂在 `prepublishOnly`，PONYTAIL/STRUCT/CHANGE 硬规则发布前强制——"用自己的规则约束自己的发布"。
- CHG-5 的"过程约束降级为 WARN、结果约束保持阻断"是有意设计，与 KP-0060 规则-实现分离哲学一致，不算不自洽；但需清醒认识到**实际不可降级的阻断点只有 5 类**：完备性门禁、build_layers、verify_result/branch_status、E-VERIFY-003、E-SPEC-015。

### 2.2 红旗清单（按优先级）

| # | 级别 | 问题 | 位置 | 影响 |
|---|---|---|---|---|
| R1 | P0 | **Dogfood 滞后**：根部 AGENTS.md/CLAUDE.md 仍是旧式全量生成内容，CLAUDE.md 不是 `@AGENTS.md` 薄壳 | 仓库根目录 | 新的 canonical-first 方案（rules-generator.ts）在自己的仓库上从未运行过；"卖.bridge 但自己不用"损害可信度 |
| R2 | P0 | **未自用 CHG-7**：本仓库无 `.mumuspec/workflow.yaml` | `.mumuspec/` | 项目级 override 的真实用户是"mumuspec 自己"，缺这一层 dogfood，边界 case（损坏回退、WARN 提示）无人验证 |
| R3 | P1 | **DS-005 空壳**：任务粒度检查为占位（`void GranularityLimit`） | guard/phase-guard.ts:620-631 | 门禁表声称存在的检查实际不执行，违反"代码与文档一致"原则 |
| R4 | P1 | **命令重复**：`spec drift` ≈ `spec detect`；`knowledge search` 与 `search2` 并存 | cli/commands/spec.ts:393-465 等 | 42 个顶层命令 + 30+ knowledge 子命令，CLI 面已超出"最小可工作"原则（违反自家 Level-1 YAGNI） |
| R5 | P2 | **三处需人工同步**：workflow.default.yaml ↔ buildFallbackConfig ↔ PHASE_ORDER | phase-graph-loader.ts | 有 AC-01 同构测试兜底，可接受但脆弱 |
| R6 | P2 | AGENTS.md 中宣称"子级变更未完成前严禁 mark 父级 done"的硬性约束，**代码中不存在 sub-change 概念** | AGENTS.md vs src/ | 文档承诺的机制与实现脱节（并行约束实际是"每 scope 单活跃变更"） |

### 2.3 自洽性判定

**主链自洽，边缘不自洽。** 状态机、门禁、错误码、enforcement 四者互相引用且由测试锁定；不自洽集中在"新能力落地后旧产物未迁移"（R1/R2）和"声明多于实现"（R3/R6）——都属于可在一个 CHG 内修复的债务，而非架构性矛盾。

---

## 三、生态调研（2026-09 时点）

### 3.1 AGENTS.md：已成基础设施

- 由 Linux Foundation 下 AAIF 托管（OpenAI/Anthropic/Block 共同创立），**60,000+ 开源项目采用，25+ 工具原生支持**。
- Claude Code 是最著名的例外（只读 CLAUDE.md），社区通行做法正是 MumuSpec 已实现的 **CLAUDE.md 首行 `@AGENTS.md` 薄壳桥接**——arXiv 对 2,853 个仓库的实证研究显示 CLAUDE.md→AGENTS.md 是最常见的引用方向（301 例），验证了这一桥接是事实标准做法。
- `.cursorrules`/`.windsurfrules` 已被明确定性为遗留格式，主流建议停止生成——MumuSpec D2 决策正确。

### 3.2 Agent Skills：爆发但泥沙俱下

- SKILL.md 于 2025-12 成为开放标准（agentskills.io），**约 40 个产品兼容**；市场规模 49 万+，但 SkillsBench 分析 47,150 个公开 skill 的**平均质量仅 6.2/12**，Snyk 检出 **36% 含 prompt injection**。
- 三层上下文模型成为共识：**AGENTS.md（常驻）+ SKILL.md（按需）+ MCP（执行）**。
- 对 MumuSpec 的含义：`skills/` 目录当前的 skill 形态（AUTHORING_PROTOCOL）与 SKILL.md 标准是两个体系；发布一个符合开放标准的 skill 是最低成本的获客通道。

### 3.3 SDD 工具对比：MumuSpec 的坐标

| 工具 | 门禁强度 | Spec 即源 | 漂移检测 | 契约管理 | 锁定 |
|---|---|---|---|---|---|
| GitHub Spec Kit | ❌ 纯约定 | 部分 | ❌ | ❌ | 无 |
| OpenSpec | ❌ validate 仅查结构 | 部分（delta 追踪） | ⚠️ 手动（社区头号抱怨） | ❌ | 无 |
| AWS Kiro | ⚠️ review-gated + hooks 跑测试 | ✅ | 部分 | ❌ | Kiro IDE |
| BMAD-METHOD | ⚠️ 角色交接即门禁 | ✅（重仪式） | ❌ | ❌ | 无 |
| Tessl | n/a（beta） | ✅ 最激进（代码可重生成） | n/a | ❌ | 平台 |
| **MumuSpec** | ✅ **exit code 级硬门禁 + fail-closed** | ✅ | ✅ **自动 drift 命令** | ✅ **唯一有契约注册/边界/兼容检查** | 无 |

**定位结论：生态公认两大痛点是"spec 漂移无自动检测"（OpenSpec 社区头号抱怨）与"流程靠自觉无强制"（Spec Kit 被批 reinvented waterfall）。MumuSpec 恰好在这两点上是最强实现，且无 IDE/平台锁定——这是真实的差异化空位，不是伪需求。**

### 3.4 风险信号

- 赛道拥挤且头部（Spec Kit ~30 agents、OpenSpec 21+ agents）以"零依赖、5 分钟上手"竞争；MumuSpec 的 init/门禁/契约体系学习成本显著更高。
- 学术实证（arXiv 2602.14690）显示：多数仓库只用到最简单的 Context Files，**重型配置机制的实际采用率很低**——"强"不等于"被用"。

---

## 四、建议

### P0（1 个 CHG 内可完成，修复可信度）

1. **Dogfood 清算**：在新仓库分支上运行自家 canonical-first 生成器，将根部 AGENTS.md/CLAUDE.md 迁移到 `@AGENTS.md` 薄壳模式；为 `.mumuspec/` 创建 workflow.yaml 实际启用 CHG-7。这一举同时消除 R1/R2，且生成过程本身就是对新安装层的集成测试。
2. **修正 AGENTS.md 中不存在的"父子变更硬约束"表述**（R6）：改为如实描述"每 scope 单活跃变更"，或实现它——文档与实现二选一对齐。

### P1（下一版本主线）

3. **补 DS-005 或删除声明**：空壳检查要么实现最小可用版（如按 build_layers 行数设阈值），要么从门禁表中移除并在 CHANGELOG 说明。
4. **CLI 面瘦身**：合并 `drift`/`detect`、`search`/`search2`；对 42 个顶层命令做分组归并（如 `knowledge` 的 30+ 子命令拆出实验性的 search2/chat/onboard）。门禁强度是卖点，命令数量是反卖点。
5. **发布符合 SKILL.md 开放标准的 mumuspec-workflow skill**：把 `mumuspec skill` 的产物对齐 agentskills.io 格式并发布到 skills.sh/SkillsMP。这是目前生态中成本最低的分发通道（40 个兼容工具），远比仅靠 npm 包名获客有效。

### P2（方向性）

6. **借鉴 OpenSpec 的 delta 追踪叙事**：MumuSpec 的 delta-specs/ 机制其实比 OpenSpec 更完整（有 scope 子树校验），但缺乏可讲的故事——考虑在 README 用"ADDED/MODIFIED/REMOVED"式对比表呈现。
7. **量化 enforcement 价值**：利用自家 eval 模块产出一份"开启门禁 vs 关闭门禁"的回归数据（类似 SkillsBench 的 16.2pp 叙事），把"强执行"从哲学主张变成可引用的数字。
8. **警惕重量化**：实证研究显示重型机制采用率低；建议保留 enforcement 硬核的同时提供一条"lite"接入路径（仅 AGENTS.md + validate + drift 三个命令即可获益），降低首跑门槛。

---

## 附：数据来源

- 代码勘察：src/cli、src/change、src/guard、src/install、src/knowledge、src/mcp-server.ts、.mumuspec/、CHANGELOG.md（本仓库实况）
- 生态：agentskills.io / AAIF（Linux Foundation）、arXiv 2602.14690（2,853 仓库配置实证）、SkillsBench（47,150 skills 质量分析）、Snyk ToxicSkills、Spec Kit / OpenSpec / Kiro / BMAD / Tessl 2026 对比综述
