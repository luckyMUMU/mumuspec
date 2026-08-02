---
scope: src/cli/commands
layer: 2
---

# Technical Design: cli/commands

## SHALL constraints

- 每个命令文件必须导出 register* 函数（接收 Commander program 参数）
- 命令逻辑必须仅做参数解析和输出格式化，业务逻辑委托给领域模块
- 所有命令必须通过 findProjectRoot 定位项目根目录
- 错误必须使用 formatError 格式化输出

## SHALL NOT constraints

- 禁止在命令文件中实现领域业务逻辑
- 禁止命令文件直接操作文件系统（必须通过领域模块 API）
- 禁止命令文件之间产生直接依赖（共享逻辑放在 helpers.ts）

## Enforcement

- CMD-1: 检查每个命令文件导出 register* 函数
- CMD-2: 检查命令逻辑不包含领域业务逻辑
- CMD-3: 检查错误输出使用 formatError

## 架构决策 (Architecture decisions)

- **薄层模式**：每个命令文件是 CLI 参数和领域模块之间的薄层，仅做解析和格式化
- **统一注册**：所有 register* 函数在 cli/index.ts 中按顺序调用
- **Agent 安装工厂**：createAgentInstallSubcommand 工厂函数为非 CatPaw agent 复用安装逻辑
- **输出模式**：人类可读（默认）和 JSON（--json）双模式输出
- **命令分组**：复杂功能域使用子命令组（如 knowledge list/get/search/context）

## 接口契约 (Interface contracts)

```typescript
// 每个命令文件的标准导出签名
export function registerXxxCommands(program: Command): void;

// 典型命令实现模式
program.command('xxx').description('...').argument(...).option(...).action((args, opts) => {
  const root = findProjectRoot();
  if (!root) { console.error('Error: Not in a MumuSpec project.'); process.exit(1); }
  const config = loadConfig(root);
  // 调用领域模块 API
  // 格式化输出
});
```

## 依赖关系 (Dependencies)

- **上游**：所有领域模块（core、spec、change、guard、knowledge、rules、install、hooks、eval、i18n、skill-authoring、bundle、feedback）
- **跨文件**：`../helpers.ts`（共享辅助函数）
- **外部依赖**：commander（Command 类型）
- **下游**：被 `src/cli/index.ts` 调用注册命令
