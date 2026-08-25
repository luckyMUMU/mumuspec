---
scope: src/core
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: core

## 模块职责 (What this module does)

MumuSpec 的核心基础设施层，提供类型定义、配置管理、工具函数、约束求值、环境检测和项目分析。

- **types.ts** — 全局类型定义（ConstraintType、ChangeState、SpecFile、KnowledgePage 等）
- **config.ts** — 配置加载/保存/默认值，约束强度求值（STRENGTH_ACTION_MAP）
- **utils.ts** — 通用工具（readYaml/writeYaml、ensureDir、computeHash、parseFrontmatter 等）
- **errors.ts** — MumuSpecError 错误类与格式化
- **env-detector.ts** — 并行检测开发工具（Java/Node/Python/Go/Rust 生态）
- **constraint-evaluator.ts** — 约束强度运行时求值（block/warn/info）
- **constraints-loader.ts** — 树分布式 constraints.yaml 文件加载
- **project-analyzer.ts** — 自动分析项目类型、框架和结构
- **init-generator.ts** — 基于项目分析生成初始 spec/design/知识库
- **doc-importer.ts** — 导入已有文档和第三方 spec（OpenSpec/OpenAPI/GraphQL 等）

## 存在理由 (Why it exists)

所有其他模块依赖 core 提供的基础能力。core 封装了与文件系统交互的底层操作、
统一类型系统、以及约束强度的核心算法。将基础设施集中在一处避免重复实现，
并确保全系统对配置、错误和工具的行为一致。

## 用户场景 (User scenarios)

1. **项目初始化**：`mumuspec init` 触发 project-analyzer + init-generator 自动生成规范
2. **环境检测**：`mumuspec env detect` 并行检测所有工具，输出环境规范文件
3. **约束配置**：开发者通过 config.yaml 调整 constraint_strength，core 负责求值
4. **文档导入**：init 时自动导入 README、CONTRIBUTING、OpenAPI 等

## 验收标准 (Acceptance criteria)

- env-detector 使用 Promise.all 并行检测，全量检测在 2 秒内完成
- 单项工具检测有 1 秒超时保护，工具未安装时不阻断整体流程
- 检测结果过滤敏感环境变量（password/secret/token/key）
- constraint-evaluator 按 exception → override → strength 顺序求值
- constraints-loader 遍历目录树发现所有 `.mumuspec/constraints.yaml`
- project-analyzer 正确识别 React/Vue/Angular/Next.js/Nuxt/Svelte 等框架
