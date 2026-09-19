# 批2映射清单：roadmap/spec.md

| ID | 原文 | 处置 |
|---|---|---|
| ROADMAP-0 | 检查 `roadmap/` 目录仅存在于 `.mumuspec/` 内部 | A类：包 manual(原句) |
| ROADMAP-1 | 检查模块 BOUNDARY.md 中 `has_roadmap` 与实际目录一致性 | A类：包 manual(原句) |
| (item) | 禁止 `roadmap/` 目录存在于根 `.mumuspec/` 以外的位置（非 `.mumuspec/` 管辖区域） | B类：加 lex: 前缀 |
| ROADMAP-10 | 校验文件名格式 `R-\d{4}\.md` | A类：包 manual(原句) |
| ROADMAP-11 | 校验 frontmatter 必填字段完整 | A类：包 manual(原句) |
| ROADMAP-12 | 校验 `depends_on` / `mutex_with` 引用的 ID 存在性 | A类：包 manual(原句) |
| (item) | 禁止省略 frontmatter 中 `id` / `status` / `priority` / `scope` 任一 | B类：加 lex: 前缀 |
| (item) | 禁止 `depends_on` / `mutex_with` 引用不存在的 Item ID | B类：加 lex: 前缀 |
| ROADMAP-20 | 校验同一模块 `active` P0 数量 <= 1 | A类：包 manual(原句) |
| ROADMAP-21 | 校验全局 `active` P0 数量 <= 3 | A类：包 manual(原句) |
| ROADMAP-22 | 校验模块 `active` P1 <= 3 | A类：包 manual(原句) |
| (item) | 禁止同一模块有超过 3 个 `active` P1 Item（避免资源分散） | B类：加 lex: 前缀 |
| ROADMAP-30 | 校验依赖图无环（拓扑排序验证） | A类：包 manual(原句) |
| ROADMAP-31 | 校验依赖方 target_date 晚于被依赖方 | A类：包 manual(原句) |
| ROADMAP-32 | 校验被依赖 Item deprecated 时依赖方状态 | A类：包 manual(原句) |
| (item) | 禁止 `depends_on` 形成环（A→B→A 或更长环） | B类：加 lex: 前缀 |
| ROADMAP-40 | 校验互斥矩阵对称性 | A类：包 manual(原句) |
| ROADMAP-41 | 校验互斥 Item 无同时 active | A类：包 manual(原句) |
| ROADMAP-42 | 校验 mutex_with 与 depends_on 无交叠 | A类：包 manual(原句) |
| (item) | 禁止 `mutex_with` 与 `depends_on` 指向同一目标（语义矛盾） | B类：加 lex: 前缀 |
| (item) | 禁止互斥 Item 的 `target_date` 相同（如果时间完全不重叠则不构成互斥） | B类：加 lex: 前缀 |
| ROADMAP-50 | 校验状态转换合法性 | A类：包 manual(原句) |
| (item) | 禁止跳过 `planned` 直接从 `planning` 进入 `active` | B类：加 lex: 前缀 |
| (item) | 禁止从 `completed` 回退到任何中间状态 | B类：加 lex: 前缀 |
| ROADMAP-60 | 全局依赖图无环（跨模块） | A类：包 manual(原句) |
| ROADMAP-61 | 全局 active P0 总数上限 | A类：包 manual(原句) |
| ROADMAP-62 | 跨模块互斥对称性 | A类：包 manual(原句) |
| ROADMAP-70 | 校验全局 active 数量上限 | A类：包 manual(原句) |
| ROADMAP-71 | 校验模块级 active 数量上限 | A类：包 manual(原句) |
| ROADMAP-72 | 校验容量预算不超支 | A类：包 manual(原句) |
| ROADMAP-80 | `items/` 中不允许存在 `status: completed` 的 Item | A类：包 manual(原句) |
| ROADMAP-81 | 归档 Item 的 `supersedes` 引用链完整性 | A类：包 manual(原句) |

A类 23 / B类 9 / D类(指针,不动) 0
