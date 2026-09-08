# Contributing to MumuSpec

感谢你关注 MumuSpec！本指南帮助贡献者快速上手并保持代码库一致。

---

## 开发环境

- **Node.js**: >= 20 (推荐使用 `.nvmrc` 或 volta 锁定)
- **包管理器**: npm (lockfile 已提交)
- **IDE**: 推荐 VS Code + TypeScript 插件

```bash
git clone https://github.com/mumuspec/mumuspec.git
cd mumuspec
npm install
npm run build
```

---

## 分支与提交规范

### 分支命名

| 前缀 | 用途 |
|------|------|
| `feature/` | 新功能 |
| `fix/` | 缺陷修复 |
| `refactor/` | 结构重组 |
| `docs/` | 纯文档改动 |
| `chore/` | 构建/脚本/依赖 |
| `test/` | 测试补全或修复 |

### 提交消息（ Conventional Commits ）

```
<type>(<scope>): <简短中文描述>

<可选正文>
```

示例：

```
feat(cli): 新增 feedback status 命令

fix(change): 修复归档路径拼接跨平台的正反斜杠问题
```

---

## 代码质量门控

### 必需检查

```bash
# 构建类型检查 (同时也是 lint)
npm run build

# 全量测试 (约 4900 用例)
npm test

# 预发布校验 (package.json 版本同步 + bin 源文件存在)
node scripts/prebuild-check.mjs
```

### TypeScript 严格性规则

项目启用完整 TypeScript 严格家族 (`strict: true`) 外加：

- `noUnusedLocals: true` — 禁止未使用局部变量
- `noUnusedParameters: true` — 禁止未使用参数 (函数参数以 `_` 前缀豁免)
- `noImplicitReturns: true` — 函数每个分支必须显式返回
- `noFallthroughCasesInSwitch: true` — switch 中禁止 case 穿透 (除非显式注释 `// falls through`)

导致构建失败的类型绕过 (`as any`、`@ts-ignore`) 在 PR 中会被拒绝，应改为精确类型标注。

### Ponytail 编码约束

本项目的所有源码须遵循 **Ponytail 7 级优先级阶梯**（详见 AGENTS.md / CLAUDE.md）：

1. 不需要的代码不写 (YAGNI)
2. 已有实现复写，不重造轮子
3. 标准库优先
4. 平台原生特性优先
5. 已安装依赖能做则不引入新依赖
6. 能一行写完不封装
7. 以上皆否才写最小可工作代码

有意简化处必须使用 `// ponytail: <原因>` 标记。

---

## 零依赖模块约束

以下模块禁止导入任何外部依赖 (仅可使用 `node:` 内置模块)：

- `src/install/`
- `src/bundle/`
- `src/i18n/`
- `src/skill-authoring/`
- `src/core/env-detector.ts`

新增源文件须归属上述模块时，注意保持该约束。

---

## 测试要求

### 框架

项目使用 **vitest** 作为测试框架，测试文件为 `tests/**/*.test.ts`。

### 命名与组织

- 文件名：`<模块功能>.test.ts`
- 文件内使用 `describe / it` 组织
- 长测试用例给出业务意图描述 (`it('当 xxx 时 应 yyy')`)

### 副作用隔离

- 禁止依赖全局真实文件系统；使用 `node:fs.mkdtempSync` 创建临时目录
- 禁止依赖真实 git 环境；如需测试 git 流程，使用临时 git 仓库 (`git init` 在 tmpdir)
- 禁止依赖真实网络请求；使用 mock 或服务端 stub

### 当前覆盖范围

244+ 个测试文件 / 约 4900 用例覆盖以下模块：

- CLI 端到端 (cli.test.ts)
- 约束强度与继承 (constraint-strength.test.ts, inheritance.test.ts, ponytail.test.ts)
- 状态机与版本递增 (state-machine.test.ts, version-bump.test.ts)
- Env 检测与 Git (env-detector.test.ts, env-cli.test.ts, env-init.test.ts, git.test.ts)
- 知识层 (knowledge-manager.ua.test.ts, types.ua.test.ts)
- Spec 解析 (parser.test.ts)

新增功能须包含对等测试用例；重构若破坏既有测试须说明原因。

---

## Bug 报告与功能请求

### 提交 Issue

请到 GitHub Issues 提交，包含：

1. 标题清晰描述问题或诉求
2. 复现步骤 (Bug) 或 使用场景 (Feature)
3. MumuSpec 版本 (`mumuspec --version`)
4. Node.js 版本,操作系统
5. 若可能，附上最小复现仓库或截图

### 反馈类型

- `bug`: 功能与文档描述不符
- `feature-request`: 新能力诉求
- `question`: 使用疑问
- `docs`: 文档缺漏或错误

---

## 社区公约

- 使用尊重、包容的语言
- 承认贡献者的劳动 (PR 合并后 changelog 会标注)
- 重大改动先提 Issue 讨论，避免大 PR 被拒绝

---

## 许可

贡献本仓库即表示你同意你的贡献在 [MIT License](LICENSE) 下发布。
