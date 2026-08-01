# Proposal: add-env-spec

## Why

MumuSpec 当前的项目分析能力（`project-analyzer.ts`）专注于代码层面的检测 — 项目类型、框架、语言、测试工具等。但在实际开发中，**环境配置和工具链位置**同样关键：

1. **新人入职需要知道**：JDK 安装路径、Maven/Gradle 位置、Python 虚拟环境、Node 版本
2. **CI/CD 依赖环境声明**：构建脚本需要知道工具位置，但缺乏标准化记录方式
3. **多项目切换时信息丢失**：不同项目可能依赖不同版本的工具（如 Java 8 vs Java 17）
4. **环境漂移未被检测**： teammates 环境差异导致的"在我机器上能跑"问题

现有的 Knowledge Layer 只记录架构决策和代码模式，**缺乏环境/工具链信息的结构化记录能力**。

## What

引入 **Environment Spec（环境规范）** 作为 MumuSpec 的一等公民：

### A. 环境检测器（`src/core/env-detector.ts`）

新增模块用于检测并记录核心工具的位置和版本：

- **Java 生态**：JDK（`JAVA_HOME`、`java -version`）、Maven（`mvn -version`、`~/.m2`）、Gradle
- **Node 生态**：Node.js、npm、pnpm、yarn
- **Python 生态**：Python 版本、pip、virtualenv/conda
- **构建工具**：Make、CMake、Docker
- **操作系统**：OS 类型、架构、环境变量

### B. 环境规范格式（`env-spec.md`）

新增一种标准 spec 文件格式 `.mumuspec/env-spec.md`：

```yaml
---
layer: 0
scope: ".env"
type: environment
last_updated: "2026-08-01"
---

## Environment: Java Development Kit

### SHALL
- JDK version MUST be 17 or higher
- JAVA_HOME MUST be set and point to a valid JDK installation

### Detected
- location: /usr/lib/jvm/java-17-openjdk
- version: 17.0.8
- vendor: Eclipse Temurin

## Environment: Build Tools

### SHALL
- Maven 3.8+ MUST be available on PATH
- ~/.m2/settings.xml MUST mirror configuration

### Detected
- maven_location: /opt/maven/3.9.4
- maven_version: 3.9.4
```

### C. CLI 命令扩展

新增 `mumuspec env` 命令族：

```bash
mumuspec env detect          # 检测并输出当前环境信息
mumuspec env detect --save  # 检测并保存到 .mumuspec/env-spec.md
mumuspec env validate       # 验证当前环境是否符合 env-spec.md 声明
mumuspec env diff           # 对比两个环境的差异
```

### D. 集成到 init 流程

在 `mumuspec init` 时自动执行环境检测，将结果作为初始 Knowledge Page 写入知识库。

## Impact Scope

- `src/core/env-detector.ts` — 新增，核心检测逻辑
- `src/core/types.ts` — 新增 `EnvironmentSpec`、`DetectedTool` 类型
- `src/cli.ts` — 新增 `env` 子命令
- `src/core/init-generator.ts` — 初始化时调用环境检测
- `.mumuspec/spec.md` — 新增 Requirement 条目（Layer 0）
- `src/mcp-server.ts` — 新增 `detect_environment` MCP 工具（可选）

## Constraints

- 环境检测 MUST NOT 执行耗时操作（单次检测 < 2s）
- 检测逻辑 MUST 容错（某个工具未安装不阻断整体流程）
- env-spec.md 的 Detected 部分 MUST 可自动更新（`env detect --save`）
- SHALL NOT 记录敏感信息（如包含密码的环境变量）

## Workflow

full
