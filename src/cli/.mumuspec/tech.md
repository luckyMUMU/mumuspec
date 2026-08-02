---
scope: src/cli
layer: 2
---

# Technical Design: cli

## SHALL constraints

- CLI 入口必须使用 Commander.js 框架注册所有子命令
- 所有命令模块必须通过 register* 函数注册到主 program
- init 命令必须执行项目分析、文档导入和规范生成
- 错误必须使用 formatError 格式化输出（包含错误码和上下文）
- 必须在命令执行前初始化 locale（initLocale）

## SHALL NOT constraints

- 禁止在 helpers.ts 中包含领域逻辑（仅共享辅助函数）
- 禁止在 index.ts 中实现具体命令逻辑（仅注册和路由）
- 禁止命令模块直接操作文件系统（必须通过领域模块 API）

## Enforcement

- CLI-1: 检查所有命令模块已注册
- CLI-2: 检查错误使用 formatError 输出
- CLI-3: 检查 init 命令生成完整的初始工件集

## 架构决策 (Architecture decisions)

- **Commander.js 框架**：使用 Commander 的 .command() 链式 API 注册子命令
- **命令模块拆分**：每个功能域一个命令文件（spec.ts、change.ts、guard.ts 等），通过 register* 函数注册
- **共享 helpers**：getCssSummary、getDirectorySummary、executeChat、collect、createAgentInstallSubcommand
- **init 流程**：analyzeProject → generateInitialSpec → generateInitialDesign → scaffoldKnowledgeBase → generateRulesFiles → importDocuments
- **错误处理**：捕获 MumuSpecError 并用 formatError 输出友好信息，包含错误码和修复建议
- **JSON 模式**：部分命令支持 --json 选项，输出结构化 JSON

## 接口契约 (Interface contracts)

```typescript
// index.ts
import { Command } from 'commander';
const program = new Command();
program.name('mumuspec').version('0.13.0-alpha.2');
registerSpecCommands(program);
registerChangeCommands(program);
// ... all command registrations
program.parse();

// helpers.ts
function getCssSummary(analysis: ProjectAnalysis): string;
function executeChat(root: string, config: MumuSpecConfig, query: string, jsonMode?: boolean): void;
function createAgentInstallSubcommand(cmd: Command, agentName: string, agentType: string, desc: string): void;
```

## 依赖关系 (Dependencies)

- **上游**：几乎所有领域模块（core、spec、change、guard、knowledge、rules、install、hooks、eval、i18n、skill-authoring、bundle、feedback）
- **外部依赖**：commander（CLI 框架）
- **下游**：被 src/cli.ts（向后兼容入口）调用，最终由 package.json bin 入口触发
