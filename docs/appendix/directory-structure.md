# 完整目录结构示例

> 层级: Level 3 附录

---

```
my-project/
│
├── .mumuspec/                              # === 根层规范 (Level 0) ===
│   ├── config.yaml                         # MumuSpec 全局配置
│   ├── spec.md                             # 全局架构规范
│   ├── design.md                           # 根层设计文档（架构决策、技术选型）
│   ├── prohibitions.md                     # 全局禁止清单
│   ├── index.yaml                          # 子目录规范索引
│   │
│   ├── contracts/                          # 契约层（0.8.0 新增）
│   │   ├── external/                       # 外部服务契约
│   │   │   ├── payment-service.yaml        # 支付服务（gRPC）
│   │   │   ├── user-center-api.yaml        # 用户中心（REST API）
│   │   │   ├── kafka-mq.yaml               # Kafka 消息队列
│   │   │   └── _index.yaml                 # 外部服务契约索引
│   │   ├── outbound/                       # 自身对外契约
│   │   │   ├── user-api.yaml               # 用户 API（REST）
│   │   │   ├── order-rpc.yaml              # 订单 RPC（gRPC）
│   │   │   └── _index.yaml                 # 对外契约索引
│   │   ├── schemas/                        # 共享 Schema 定义
│   │   │   ├── common/                     # 公共类型（分页、错误码等）
│   │   │   └── enums/                      # 共享枚举
│   │   └── _registry.yaml                  # 契约注册表
│   │
│   ├── changes/                            # 变更管理
│   │   ├── add-user-auth/                  # 活跃变更
│   │   │   ├── .mumuspec.yaml              # 变更状态
│   │   │   ├── proposal.md
│   │   │   ├── cognitive-map.yaml          # 认知地图（0.8.0 新增）
│   │   │   ├── design.md
│   │   │   ├── tasks.md
│   │   │   ├── delta-specs/
│   │   │   │   └── src-auth/spec.md
│   │   │   ├── constraints/
│   │   │   │   ├── new-shall.md
│   │   │   │   └── new-shall-not.md
│   │   │   ├── test-cases/                 # 测试用例规格（0.6.0 新增）
│   │   │   │   ├── layer-0-cases.md        # 根层测试用例
│   │   │   │   ├── layer-1-cases.md        # src 层测试用例
│   │   │   │   └── layer-2-cases.md        # auth 层测试用例
│   │   │   ├── suite-map.yaml              # 测试套件映射（0.6.0 新增）
│   │   │   ├── decisions.md                # 决策记录（0.7.0 新增）
│   │   │   ├── code-graph/
│   │   │   │   ├── impact-analysis.json
│   │   │   │   └── base-ref.txt
│   │   │   ├── snapshots/                  # 回退快照
│   │   │   └── verify.md
│   │   └── archive/
│   │       └── 2026-07-01-fix-login/
│   │
│   ├── skills/                             # AI Skill 定义
│   │   ├── mumuspec-open.md
│   │   ├── mumuspec-design.md
│   │   ├── mumuspec-build.md
│   │   ├── mumuspec-verify.md
│   │   ├── mumuspec-archive.md
│   │   ├── mumuspec-hotfix.md
│   │   ├── mumuspec-tweak.md
│   │   └── custom/                         # 项目自定义 Skill
│   │
│   ├── knowledge/                              # 知识层（0.9.0 新增）
│   │   ├── _index.yaml                         # PageIndex 主索引
│   │   ├── _reverse-index.yaml                 # 反向索引（代码节点→知识页面）
│   │   ├── decisions/                          # 架构决策记录
│   │   │   └── KP-0001-payment-saga.md
│   │   ├── patterns/                           # 设计模式
│   │   ├── risks/                              # 已知风险
│   │   ├── rationale/                          # 设计理由
│   │   ├── lessons/                            # 经验教训
│   │   └── _archive/                           # 已废弃/已替代的知识页面
│   │
│   ├── templates/                          # 文档生成模板
│   │   ├── technical-root.yaml
│   │   ├── technical-module.yaml
│   │   ├── business-root.yaml
│   │   └── business-module.yaml
│   │
│   ├── scripts/                            # 校验脚本
│   │   ├── guard.mjs                       # 阶段守卫
│   │   ├── state.mjs                       # 状态机管理
│   │   ├── check.mjs                       # 规范校验
│   │   ├── drift.mjs                       # 漂移检测
│   │   └── doc-gen.mjs                     # 文档生成引擎
│   │
│   ├── audit.log                           # 审计日志（JSONL 格式）
│   │
│   └── graph/                              # 代码图谱数据（Knowledge Layer 子组件）
│       ├── index.db                        # 图谱数据库 (SQLite)
│       └── snapshot.json                   # 图谱快照
│
├── docs/                                   # === 对外文档输出（自动生成） ===
│   ├── technical/                          # 技术文档
│   │   ├── architecture.md                 # 系统架构总览
│   │   ├── tech-standards.md               # 技术规范汇总
│   │   ├── module-auth.md                  # 认证模块技术文档
│   │   ├── module-api.md                   # API 模块技术文档
│   │   └── api-reference.md                # API 参考文档
│   ├── business/                           # 业务文档
│   │   ├── overview.md                     # 业务全景概览
│   │   └── feature-auth.md                 # 认证功能业务说明
│   ├── integration/                        # 集成指南（0.8.0 新增）
│   │   ├── api-user-api.md                # 用户 API 集成指南
│   │   ├── rpc-order-rpc.md               # 订单 RPC 接口文档
│   │   └── events-user-events.md          # 用户事件订阅指南
│   └── dependencies/                       # 外部依赖文档（0.8.0 新增）
│       ├── ext-payment-service.md         # 支付服务调用指南
│       ├── ext-user-center-api.md         # 用户中心调用指南
│       └── ext-kafka-mq.md                # Kafka 消息队列使用指南
│
├── src/
│   ├── .mumuspec/                          # === src 层规范 (Level 1) ===
│   │   ├── spec.md                         # 编码规范
│   │   ├── design.md                       # src 层设计文档
│   │   ├── prohibitions.md                 # src 层禁止项
│   │   └── index.yaml                      # 子模块索引
│   │
│   ├── auth/
│   │   ├── .mumuspec/                      # === auth 层规范 (Level 2) ===
│   │   │   ├── spec.md                     # 认证规范
│   │   │   ├── design.md                   # 认证模块设计文档
│   │   │   └── prohibitions.md             # 认证禁止项
│   │   ├── login.ts
│   │   └── token.ts
│   │
│   ├── api/
│   │   ├── .mumuspec/                      # === api 层规范 (Level 2) ===
│   │   │   ├── spec.md                     # API 规范
│   │   │   ├── design.md                   # API 层设计文档
│   │   │   ├── prohibitions.md             # API 禁止项
│   │   │   └── index.yaml                  # 子目录索引
│   │   │
│   │   ├── controllers/
│   │   │   ├── .mumuspec/                  # === controllers 层 (Level 3) ===
│   │   │   │   ├── spec.md                 # Controller 规范
│   │   │   │   └── design.md               # Controller 层设计文档
│   │   │   └── user.controller.ts
│   │   │
│   │   └── middlewares/
│   │       └── auth.middleware.ts
│   │
│   └── lib/
│       ├── .mumuspec/                      # === lib 层规范 (Level 2) ===
│       │   ├── spec.md
│       │   └── design.md                   # 工具库设计文档
│       └── utils.ts
│
├── tests/
│   └── .mumuspec/                          # === tests 层规范 (Level 1) ===
│       ├── spec.md
│       └── design.md                       # 测试策略设计文档
│
├── .github/
│   └── workflows/
│       └── mumuspec-check.yml              # CI/CD 校验流水线
│
├── CLAUDE.md                               # AI Rules 文件（自动生成）
├── .cursorrules                            # Cursor Rules（自动生成）
└── package.json
```

---

> **导航**: [对比 →](comparison.md) | [返回概览](../overview.md)
