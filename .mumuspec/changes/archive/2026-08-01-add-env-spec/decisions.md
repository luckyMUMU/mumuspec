# Change Decisions

## DEC-001: 环境检测器作为独立 Core 模块

**心理模型**: 单一职责 + 可测试性

**决策**: 将环境检测逻辑提取为独立的 `src/core/env-detector.ts` 模块，而非嵌入 `project-analyzer.ts`。

**结果**:
- `project-analyzer.ts` 仅关注代码/结构分析
- `env-detector.ts` 专注于运行时工具链检测
- 两个模块可独立测试和演进
- 符合 Core 层现有的模块拆分模式

## DEC-002: env-spec.md 作为 Requirement 扩展

**心理模型**: 复用现有 Spec Layer

**决策**: `env-spec.md` 沿用现有 spec.md 格式（frontmatter + SHALL/SHOULD/SHOULD NOT + Enforcement），通过 `type: environment` 区分。

**结果**:
- Spec parser 无需修改即可解析新格式
- Validator 可复用现有校验逻辑
- 区别于代码规范，env-spec 主要记录 Detected 自动结果

## DEC-003: CLI 命令采用现有 Commander 模式

**心理模型**: boring over clever

**决策**: `mumuspec env` 子命令复用现有 Commander.js 注册模式，遵循现有命令输出格式（颜色、图标、退出码）。

**结果**:
- 与现有 `mumuspec knowledge`、`mumuspec state` 命令风格一致
- 降低用户学习成本

## DEC-004: 检测逻辑 MUST 安全且只读

**心理模型**: 安全优先

**决策**: 环境检测仅执行只读命令（`--version`、`which`、`echo $VAR`），绝不修改任何配置。敏感环境变量（含 password/secret/token 关键词）自动过滤。

**结果**:
- 工具不会意外破坏用户环境
- env-spec.md 不会泄露敏感信息
- CI/CD 场景安全可用

## DEC-005: init 集成检测范围由项目配置推断

**心理模型**: 自动化优先、配置为辅

**决策**: 通过扫描项目根目录文件（pom.xml、build.gradle、package.json 等）自动推断需要检测的工具链，而非要求用户手动配置。

**结果**:
- 零配置体验
- 检测结果与项目实际需求匹配

## DEC-006: 仅使用 Node.js 内置模块

**心理模型**: 零运行时依赖偏好（Ponytail）

**决策**: env-detector.ts 仅使用 Node.js 内置模块（child_process、os、fs、path、util），不引入外部依赖。

**结果**:
- 符合 install、bundle、i18n、skill-authoring 模块的零依赖模式
- 更小的安装体积和更少的 breaking changes

---

## Design Phase 追加

## DEC-D-001: Detected 部分自动覆盖

**决策**: env-spec.md 的 Detected 部分每次 `--save` 时完全重写，确保始终反映真实环境。

**理由**: 手动修改的检测结果会过时，自动覆盖保证数据新鲜度。

## Build Phase 追加

## DEC-B-001: validateEnv 返回结构化结果

**决策**: validateEnv 返回 `{ exitCode, messages, suggestions }` 而非直接 process.exit，便于 CLI 层和测试调用。

**理由**: 分离关注点，函数负责逻辑，CLI 负责 I/O。
