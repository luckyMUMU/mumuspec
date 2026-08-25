---
id: "KP-0046"
title: "打包与部署"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/packaging-deployment.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# 打包与部署

> **Source**: `docs/reference/packaging-deployment.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 层级: Level 2 参考文档 | 关联: [release-strategy.md](release-strategy.md) (灰度/回滚策略), [configuration.md](configuration.md)

## Original Content

# 打包与部署

> 层级: Level 2 参考文档 | 关联: [release-strategy.md](release-strategy.md) (灰度/回滚策略), [configuration.md](configuration.md)

---

## 1. 概述

MumuSpec 通过 npm 分发,提供两种可执行入口:

| 入口 | 路径 | 用途 |
|------|------|------|
| `mumuspec` CLI | `dist/cli.js` | 命令行交互,规范/变更/守卫/知识管理 |
| `mumuspec-mcp` MCP Server | `dist/mcp-server.js` | 通过 MCP 协议向 AI 工具暴露规范接口 |
| 库 API | `dist/index.js` | 编程式集成 (自建 Skill 适配器等) |

**核心原则**:
- **可复现构建**: 同一 commit + 同一 Node 版本 → 字节级相同的 `dist/` 输出
- **三档发布通道**: `latest` (稳定) / `next` (预发布) / `alpha|beta|rc` (测试)
- **零运行时编译**: 发布物为纯 JS,目标用户无需安装 `typescript` / `tsx`
- **强制 Pre-build 校验**: `prebuild` 脚本阻塞不合规版本 (CLI 版本与 package.json 不同步将 abort)

---

## 2. 构建产物结构

### 2.1 tsconfig 关键配置

参见 [tsconfig.json](../../tsconfig.json):
- `target: ES2022` / `module: ES2022` — 现代语法,Node ≥ 20 原生支持
- `declaration: true` + `declarationMap: true` + `sourceMap: true` — 库消费方有完整类型与源码导航
- `outDir: ./dist` / `rootDir: ./src` — 源码与产物严格分离
- `exclude: ["node_modules", "dist", "tests", "docs"]` — 不会把测试/文档编入产物

### 2.2 files 字段 (npm 包内容)

`package.json` 的 `files` 字段白名单控制 `npm pack` 与 `npm publish` 实际包含的文件:

```
dist/                                # 编译产物 (所有 .js / .d.ts / .js.map / .d.ts.map)
docs/overview.md                     # 项目概览 (用户快速理解)
docs/STATUS.md                       # 实现进度权威源
docs/reference/cli-commands.md       # CLI 命令参考
docs/reference/configuration.md      # 配置参考
docs/reference/packaging-deployment.md # 本文档
docs/reference/release-strategy.md   # 灰度策略
docs/reference/feedback-process.md   # 反馈流程
README.md
LICENSE
CHANGELOG.md
```

**未包含** (有意排除):
- `tests/` — 测试源码不进包,用户在 `node_modules/mumuspec/` 不应看到测试
- `docs/design/` / `docs/appendix/` — 设计与附录文档体量较大,通过 GitHub 仓库阅读即可
- `demo/` — 示例项目单独发布或留在仓库
- `scripts/` — 构建辅助脚本,不属于运行时
- `.trae/` — 内部 spec 工件
- `src/` — TypeScript 源码;消费方用 `declarationMap` 即可回链到 GitHub

### 2.3 双入口 (bin)

```json
{
  "bin": {
    "mumuspec": "dist/cli.js",
    "mumuspec-mcp": "dist/mcp-server.js"
  }
}
```

两个入口文件均带 `#!/usr/bin/env node` shebang (见 [src/cli.ts:1](../../src/cli.ts#L1)),npm 安装后会在 `node_modules/.bin/` 下创建对应符号链接,用户 `npx mumuspec --version` 直接可用。

---

## 3. 版本号与发布通道

### 3.1 SemVer 与预发布标签

遵循 [SemVer](https://semver.org/),格式 `MAJOR.MINOR.PATCH[-prerelease][+build]`:

| 通道 | 标签格式 | 触发条件 | 目标用户 | npm dist-tag |
|------|---------|---------|---------|--------------|
| 内部测试 | `0.12.1-alpha.N` | 早期功能验证 | 核心团队 2-3 人 | `next` |
| 邀请测试 | `0.12.1-beta.N` | 邀请早期采用者 | 5-10 个项目 | `next` |
| 发布候选 | `0.12.1-rc.N` | 功能冻结,公开测试 | 任意愿意尝试者 | `next` |
| 稳定 | `0.12.1` | 灰度通过,正式发布 | 所有人 | `latest` |

> 详细灰度标准、回退阈值见 [release-strategy.md](release-strategy.md) §3 灰度策略。

### 3.2 版本管理脚本

`package.json` 中已配置:

```bash
# 基础版本号提升 (不创建 git tag,只改 package.json)
npm run version:patch    # 0.12.1 -> 0.12.2
npm run version:minor    # 0.12.1 -> 0.13.0
npm run version:major    # 0.12.1 -> 1.0.0

# 预发布标签管理 (自动递增/切换)
npm run version:alpha    # 0.12.1-alpha.0 -> 0.12.1-alpha.1  (相同标签递增)
                         # 0.12.1-beta.2  -> 0.12.1-alpha.0  (切换标签重置)
npm run version:beta
npm run version:rc

# 发布
npm run release:dry      # 试打包,不发布 (npm publish --dry-run)
npm run release:next     # 发布到 next 通道 (npm publish --tag next)
npm run release:latest   # 发布到 latest 通道 (npm publish --tag latest)

# 把已发布的某版本重新打 dist-tag
npm run dist-tag:next    # 把当前 package.json 版本加入 next 标签
npm run dist-tag:latest  # 把当前 package.json 版本提升为 latest
```

### 3.3 预发布版本递增规则

`scripts/bump-prerelease.mjs` 实现:

| 当前版本 | 命令 | 结果 | 说明 |
|---------|------|------|------|
| `0.12.1-alpha.0` | `npm run version:alpha` | `0.12.1-alpha.1` | 相同标签递增 |
| `0.12.1-alpha.2` | `npm run version:beta` | `0.12.1-beta.0` | 切换标签重置 |
| `0.12.1-beta.0` | `npm run version:rc` | `0.12.1-rc.0` | 切换标签重置 |
| `0.12.1` (无 prerelease) | `npm run version:alpha` | **exit 1** | 需先 `npm version patch` 建立基线,或手动改 `package.json` 加 `-alpha.0` |

切换到正式发布时,直接 `npm run version:patch` (或 minor/major) 会清掉 prerelease 后缀:

| 当前版本 | 命令 | 结果 |
|---------|------|------|
| `0.12.1-rc.2` | `npm run version:patch` | `0.12.2` |
| `0.12.1-rc.2` | `npm run version:minor` | `0.13.0` |

---

## 4. 完整发布流程

### 4.1 Pre-release (alpha / beta / rc) 流程

```bash
# 1. 确保工作区干净
git status

# 2. 切到发布分支
git checkout -b release/0.12.1-alpha.1

# 3. 更新 CHANGELOG.md (在 "Unreleased" 节添加 alpha.1 条目)

# 4. 提升预发布版本号
npm run version:alpha

# 5. 构建 + 测试 + 试打包 (prebuild 钩子会校验版本同步)
npm run build:clean
npm test
npm run release:dry     # 检查 tarball 内容与大小

# 6. 提交并打 tag
git add package.json CHANGELOG.md
git commit -m "chore(release): 0.12.1-alpha.1"
git tag v0.12.1-alpha.1

# 7. 发布到 next 通道 (需 NPM_TOKEN 环境变量)
npm run release:next

# 8. 推送代码与 tag
git push origin release/0.12.1-alpha.1
git push origin v0.12.1-alpha.1

# 9. 在 GitHub Releases 创建 release,引用 CHANGELOG 条目
# 10. 邀请测试者: npm install mumuspec@next
```

### 4.2 Stable (latest) 流程

```bash
# 1. 确认上一个 rc 在灰度窗口内无新 bug (见 release-strategy.md §3)
git checkout main
git pull

# 2. 创建发布分支
git checkout -b release/0.12.1

# 3. 把 CHANGELOG 的 "Unreleased" 节改名为 "0.12.1 - 2026-07-28"

# 4. 把 rc 版本号提升为正式版本 (清掉 prerelease 后缀)
#    手动编辑 package.json: "version": "0.12.1"
#    或: npm run version:patch  (0.12.1-rc.N -> 0.12.2, 然后手动改回 0.12.1)

# 5. 全量构建与测试
npm run build:clean
npm test
npm run release:dry

# 6. 提交 + tag
git add package.json CHANGELOG.md
git commit -m "chore(release): 0.12.1"
git tag v0.12.1

# 7. 发布到 latest 通道
npm run release:latest

# 8. 把 next 通道的 lastest 也指向新版本 (避免 next 通道回退到旧 alpha)
npm run dist-tag:next    # 把当前版本 (0.12.1) 加入 next 标签

# 9. 推送
git push origin main
git push origin v0.12.1

# 10. GitHub Release + 同步文档站点
```

### 4.3 紧急回滚

```bash
# 把 latest 标签指回上一个稳定版本 (不删除有问题的版本)
npm dist-tag add mumuspec@0.12.0 latest

# 标记有问题的版本为 deprecated
npm deprecate mumuspec@0.12.1 "Critical bug: <description>. Use 0.12.0 instead."

# 72 小时内可 unpublish (npm 政策)
# npm unpublish mumuspec@0.12.1
```

> 完整回滚矩阵见 [release-strategy.md](release-strategy.md) §4。

---

## 5. 本地试发布流程

### 5.1 dry-run (推荐,零依赖)

```bash
npm run release:dry
```

输出包含:
- `npm notice` 列出 tarball 中的所有文件与大小
- `Tarball Contents` 摘要
- 不会真正上传,可安全重复运行

### 5.2 verdaccio (本地 registry,端到端验证)

[verdaccio](https://verdaccio.org) 是轻量级 npm registry,可在本地完整模拟发布-安装流程:

```bash
# 1. 全局安装 verdaccio
npm install -g verdaccio

# 2. 启动 (默认 http://localhost:4873)
verdaccio

# 3. 创建测试用户 (交互式)
npm adduser --registry http://localhost:4873

# 4. 发布到本地 registry
npm publish --registry http://localhost:4873

# 5. 在另一个目录测试安装
cd /tmp && mkdir test-install && cd test-install
npm init -y
npm install mumuspec --registry http://localhost:4873
npx mumuspec --version
npx mumuspec-mcp --help

# 6. 测试完毕,verdaccio 数据在 ~/.local/share/verdaccio/storage,可清空重置
```

### 5.3 GitHub Packages (CI 模拟)

```bash
# 在 GitHub Actions 中,设置 NPM_TOKEN 为 GITHUB_TOKEN
# .github/workflows/release-test.yml 示例见 §7
npm publish --registry https://npm.pkg.github.com
```

---

## 6. CI/CD 集成

### 6.1 GitHub Actions: 测试与构建

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, 'release/**']
  pull_request:
    branches: [main]
jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build:clean
      - run: npm test
      - run: npm run release:dry
      - uses: actions/upload-artifact@v4
        with:
          name: dist-node${{ matrix.node }}
          path: dist/
```

### 6.2 GitHub Actions: 自动发布预发布版本

```yaml
# .github/workflows/release-prerelease.yml
name: Release Prerelease
on:
  push:
    tags: ['v*-alpha.*', 'v*-beta.*', 'v*-rc.*']
jobs:
  publish-next:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # for provenance
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      - run: npm ci
      - run: npm run build:clean
      - run: npm test
      - run: npm publish --tag next --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6.3 GitHub Actions: 稳定版本发布

```yaml
# .github/workflows/release-stable.yml
name: Release Stable
on:
  push:
    tags: ['v[0-9]+.[0-9]+.[0-9]+']  # 不带 prerelease 后缀
jobs:
  publish-latest:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      - run: npm ci
      - run: npm run build:clean
      - run: npm test
      - run: npm publish --tag latest --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          body_path: CHANGELOG.md
```

---

## 7. 用户安装方式

### 7.1 终端用户 (CLI 用户)

```bash
# 稳定版本 (推荐)
npm install -g mumuspec

# 预发布版本 (尝鲜)
npm install -g mumuspec@next

# 指定版本
npm install -g mumuspec@0.12.1-rc.2

# 不全局安装,直接 npx
npx mumuspec init my-project
```

### 7.2 项目本地依赖 (团队项目)

```bash
# 在项目根目录
npm install --save-dev mumuspec

# package.json 添加 scripts
# "scripts": { "spec": "mumuspec" }
# 团队成员 npm install 后用 npm run spec -- init
```

### 7.3 MCP Server 集成 (AI 工具用户)

在 AI 工具的 MCP 配置中添加:

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["-y", "mumuspec-mcp"],
      "env": {
        "MUMUSPEC_ROOT": "${workspaceRoot}"
      }
    }
  }
}
```

### 7.4 库 API 集成 (Skill 开发者)

```typescript
import { loadConfig, resolveConstraintTree } from 'mumuspec';

const config = loadConfig(process.cwd());
// ... 使用核心 API
```

TypeScript 类型定义随包发布 (`dist/index.d.ts`),消费方在 `tsconfig.json` 中正常 `import` 即可获得类型提示。

### 7.5 本地另一项目使用 (开发期未发布)

在 MumuSpec 尚未发布到 npm registry 前,或需要测试本地未发布改动时,可通过以下 4 种方式在另一本地项目中使用。按推荐度排序:

#### 方式 A: `npm link` (推荐 — 适合活跃开发,改动即时生效)

在 MumuSpec 源项目注册全局符号链接,在消费项目中链接使用。源项目 `dist/` 重新构建后,消费项目立即看到新版本。

**步骤**:

```bash
# 1. 在 MumuSpec 源项目根目录构建并注册全局链接
cd d:/code/AI/mumuspec
npm run build
npm link

# 2. 在另一本地项目中链接 mumuspec
cd d:/code/my-other-project
npm link mumuspec

# 3. 验证
npx mumuspec --version          # 应输出 0.12.1-alpha.0
npx mumuspec-mcp --help
```

**MCP Server 配置** (消费项目的 AI 工具配置):

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "mumuspec-mcp",
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

> `npm link` 后 `mumuspec` 与 `mumuspec-mcp` 都在全局 `PATH` 中,AI 工具可直接调用。

**源项目改动后的同步**:

```bash
# 在源项目重新构建
cd d:/code/AI/mumuspec
npm run build
# 消费项目无需任何操作,符号链接自动指向新的 dist/
```

**取消链接**:

```bash
# 在消费项目取消链接
cd d:/code/my-other-project
npm unlink mumuspec

# 在源项目取消全局注册
cd d:/code/AI/mumuspec
npm unlink
```

**注意事项**:
- `npm link` 使用符号链接,Node.js 解析 `import 'mumuspec'` 时会穿透到源项目的 `dist/`
- 消费项目的 `node_modules/mumuspec` 是符号链接,不是真实目录
- 多个消费项目可同时 link 到同一个源项目
- 如果源项目依赖了消费项目也有的包 (如 `commander`),可能出现 duplicate 实例问题,见 §9.5 故障排查

#### 方式 B: `npm pack` + `npm install <tarball>` (适合可复现的本地安装)

把 MumuSpec 打成 `.tgz` 文件,在消费项目本地安装。与 `npm link` 不同,这是**真实安装** (复制文件到 `node_modules`),不会随源项目重建而更新。

**步骤**:

```bash
# 1. 在源项目构建并打包
cd d:/code/AI/mumuspec
npm run build
npm pack
# 生成 mumuspec-0.12.1-alpha.0.tgz

# 2. 在消费项目安装 tarball
cd d:/code/my-other-project
npm install d:/code/AI/mumuspec/mumuspec-0.12.1-alpha.0.tgz

# 3. 验证
npx mumuspec --version
```

**更新到新版本**:

```bash
# 源项目 bump 版本 + 重新打包
cd d:/code/AI/mumuspec
npm run version:alpha    # 0.12.1-alpha.0 -> 0.12.1-alpha.1
npm run build
npm pack                 # 生成 mumuspec-0.12.1-alpha.1.tgz

# 消费项目重新安装
cd d:/code/my-other-project
npm install d:/code/AI/mumuspec/mumuspec-0.12.1-alpha.1.tgz
```

**适用场景**:
- 需要在 CI 中测试本地版本 (把 tarball 作为 artifact)
- 想要"冻结"某个本地版本进行回归测试
- 不想让消费项目受源项目后续改动影响

#### 方式 C: `file:` 协议直接引用 (适合简单项目)

在消费项目的 `package.json` 中直接引用源项目路径:

```json
{
  "devDependencies": {
    "mumuspec": "file:d:/code/AI/mumuspec"
  }
}
```

```bash
cd d:/code/my-other-project
npm install
```

**注意事项**:
- `file:` 协议会把源项目的 `dist/` 复制到消费项目的 `node_modules/mumuspec/`
- 源项目必须**先 `npm run build`** 生成 `dist/`,否则 `node_modules/mumuspec/dist/` 为空
- 改动源项目后,需要在消费项目重新 `npm install` 才能更新
- 相对路径 (`file:../mumuspec`) 也支持,但绝对路径更清晰

#### 方式 D: 直接 `node` 调用 (适合一次性测试,无安装)

不修改消费项目的 `package.json`,直接通过路径调用 CLI:

```bash
# 在消费项目中,直接调用源项目的 dist/cli.js
cd d:/code/my-other-project
node d:/code/AI/mumuspec/dist/cli.js init .
node d:/code/AI/mumuspec/dist/cli.js context src/api
node d:/code/AI/mumuspec/dist/cli.js validate
```

**MCP Server 配置** (AI 工具):

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "node",
      "args": ["d:/code/AI/mumuspec/dist/mcp-server.js"],
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

**适用场景**:
- 一次性试命令,不想污染消费项目的 `node_modules`
- 调试 MumuSpec CLI 行为
- AI 工具集成测试

#### 方式对比

| 方式 | 改动即时生效 | 需要 `npm install` | 受 `node_modules` 隔离 | 推荐场景 |
|------|-------------|-------------------|----------------------|---------|
| A. `npm link` | ✅ (重建 dist 后立即) | 一次性 link | ❌ (符号链接穿透) | 活跃开发,频繁迭代 |
| B. `npm pack` + tarball | ❌ (需重新安装) | 每次更新 | ✅ | CI 测试,版本冻结 |
| C. `file:` 协议 | ❌ (需重新 install) | 每次更新 | ✅ | 简单项目,固定依赖 |
| D. 直接 `node` 调用 | ✅ (重建 dist 后立即) | 不需要 | ❌ (不进 node_modules) | 一次性测试,调试 |

#### 端到端示例: 在 `my-other-project` 中用 `npm link` 试运行 MumuSpec

```bash
# === 1. 源项目: 构建 + 全局注册 ===
cd d:/code/AI/mumuspec
npm install               # 首次需要
npm run build             # 生成 dist/
npm link                  # 注册到全局

# === 2. 消费项目: 初始化 MumuSpec ===
mkdir d:/code/my-other-project
cd d:/code/my-other-project
npm init -y
npm link mumuspec         # 链接 mumuspec 到本项目

# === 3. 在消费项目中使用 ===
mumuspec --version        # 0.12.1-alpha.0
mumuspec init . --name my-app --language typescript
mumuspec context .
mumuspec validate
mumuspec new my-first-change --workflow hotfix

# === 4. AI 工具集成 (Claude Code 示例) ===
# 在 .claude/settings.json 或项目根 .mcp.json 中配置:
# {
#   "mcpServers": {
#     "mumuspec": {
#       "command": "mumuspec-mcp",
#       "env": { "MUMUSPEC_ROOT": "." }
#     }
#   }
# }

# === 5. 源项目改动后,消费项目自动同步 (无需任何操作) ===
cd d:/code/AI/mumuspec
# 修改 src/cli.ts 添加新命令...
npm run build             # 重建 dist/
# 回到消费项目,新命令立即可用:
cd d:/code/my-other-project
mumuspec --help           # 看到新命令

# === 6. 清理 ===
cd d:/code/my-other-project
npm unlink mumuspec       # 取消消费项目链接
cd d:/code/AI/mumuspec
npm unlink                # 取消全局注册
```

---

## 8. 发布前检查清单

每次发布 (任意通道) 前必须确认:

- [ ] `git status` 干净,无未提交修改
- [ ] `npm run lint` 通过 (TypeScript 无报错)
- [ ] `npm test` 全部通过
- [ ] `npm run build:clean` 成功,`dist/` 完整
- [ ] `npm run release:dry` 输出的 tarball 内容符合 `files` 白名单
- [ ] `package.json` 与 `src/cli.ts` 中版本号一致 (prebuild-check 会校验)
- [ ] `CHANGELOG.md` 已更新对应版本条目
- [ ] `docs/STATUS.md` 中"最后更新日期"已同步
- [ ] 发布目标通道正确 (`--tag next` vs `--tag latest`)
- [ ] 回滚方案已确认 (上一个稳定版本号记录在案)

---

## 9. 故障排查

### 9.1 prebuild-check 失败

```
prebuild-check: FAIL — version mismatch: package.json=0.12.1, src/cli.ts=0.10.0
```

**修复**: 把 [src/cli.ts:35](../../src/cli.ts#L35) 的 `.version('...')` 改为与 `package.json` 一致。

### 9.2 npm publish 报 403

- 检查 `NPM_TOKEN` 是否在环境中设置 (CI) 或 `~/.npmrc` 中是否已 `npm login` (本地)
- 检查包名是否被占用: `npm view mumuspec`
- 检查是否已发布过该版本: `npm view mumuspec@<version>`

### 9.3 tarball 体积过大

```bash
npm run release:dry 2>&1 | grep "npm notice"
```

如果 `dist/` 体积异常,检查:
- `tsconfig.json` 是否误把 `tests/` 或 `docs/` 包含进 `include`
- `files` 白名单是否包含了大文件
- `declaration: true` 生成的 `.d.ts` 是否包含多余内容 (检查 `export *` 是否引入了无关类型)

### 9.4 bin 命令找不到

安装后 `mumuspec --version` 报 `command not found`:

- 全局安装: 检查 `npm bin -g` 是否在 `PATH` 中
- npx: `npx mumuspec --version` 应自动下载,如失败检查网络
- 项目本地: 用 `npx mumuspec` 或在 `package.json` scripts 中用 `mumuspec`
- 检查 `dist/cli.js` 是否有 `#!/usr/bin/env node` shebang 和可执行权限 (`chmod +x dist/cli.js`)
- `npm link` 方式: 确认在源项目执行了 `npm link`,且消费项目执行了 `npm link mumuspec`;用 `npm ls -g mumuspec` 检查全局链接是否注册

### 9.5 `npm link` 导致 duplicate 依赖实例

**症状**: 消费项目通过 `npm link mumuspec` 使用本地版本后,运行时报 `commander` 或 `yaml` 的 instance 检查失败 (如 `instance instanceof X` 为 false)。

**原因**: `npm link` 让 `node_modules/mumuspec` 指向源项目目录,源项目 `node_modules/commander` 与消费项目 `node_modules/commander` 是两个不同实例。当消费项目代码与 mumuspec 代码都 `import commander` 时,Node 解析到两份不同的 `commander`,导致 `instanceof` 失败。

**修复** (任选其一):

```bash
# 方式 1: 在源项目把 link 的依赖也 link 到消费项目 (推荐)
cd d:/code/AI/mumuspec
npm link commander yaml
cd d:/code/my-other-project
npm link commander yaml

# 方式 2: 在消费项目强制用源项目的 node_modules 解析
# 设置 NODE_PATH 环境变量 (临时)
# Windows PowerShell:
$env:NODE_PATH = "d:/code/AI/mumuspec/node_modules"
mumuspec --version

# 方式 3: 改用 npm pack + tarball 安装,避免符号链接穿透 (见 §7.5 方式 B)
cd d:/code/AI/mumuspec
npm pack
cd d:/code/my-other-project
npm unlink mumuspec
npm install d:/code/AI/mumuspec/mumuspec-0.12.1-alpha.0.tgz
```

### 9.6 `npm link` 后 `mumuspec` 命令未更新

**症状**: 在源项目修改代码并 `npm run build` 后,消费项目仍运行旧版本。

**排查**:

```bash
# 1. 确认源项目 dist/ 已更新
ls -la d:/code/AI/mumuspec/dist/cli.js   # 检查修改时间

# 2. 确认消费项目链接指向源项目
ls -la d:/code/my-other-project/node_modules/mumuspec
# 应显示: -> ../../../AI/mumuspec (符号链接)

# 3. 确认全局 bin 链接
which mumuspec                            # Linux/macOS
where mumuspec                            # Windows PowerShell
# 应指向全局 npm prefix 下的 mumuspec 符号链接

# 4. 检查是否有多个 node 版本 (nvm/fnm 切换可能导致全局链接丢失)
node --version
npm prefix -g
```

### 9.7 Windows 下 `npm link` 权限问题

**症状**: Windows 下 `npm link` 报 `EPERM` 或 `EACCES`。

**修复**:

```powershell
# 1. 以管理员身份运行 PowerShell
# 2. 或修改 npm 全局目录到用户目录 (推荐,无需管理员权限)
npm config set prefix "$env:APPDATA\npm"
# 把 $env:APPDATA\npm 加入 PATH (用户环境变量)
# 重新打开终端后:
npm link
```

---

## 10. 与 release-strategy.md 的关系

本文档 (`packaging-deployment.md`) 关注**"怎么打包、怎么发布、怎么安装"**的工程实操:

- 构建产物结构、npm 字段配置、版本号脚本、CI/CD 配置、用户安装方式
- tarball 内容审计、本地试发布流程、故障排查

[release-strategy.md](release-strategy.md) 关注**"什么时候发、灰度怎么走、出问题怎么回退"**的运营策略:

- SemVer 触发条件、Pre-release 标签语义
- Canary/Beta/RC/Stable 四阶段灰度标准与通过门槛
- 配置迁移回滚、npm 包撤回、运行时变更回滚

两份文档互补: 本文档是"工程视角",release-strategy 是"运营视角"。版本号规则、预发布标签格式在两文档中保持一致。

---

> **导航**: [← 配置参考](configuration.md) | [发布与回滚策略 →](release-strategy.md) | [反馈流程 →](feedback-process.md) | [返回概览](../overview.md)

