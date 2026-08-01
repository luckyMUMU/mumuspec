# Layer 1 — CLI 命令测试用例

> 类型: TDD 测试用例 | 层级: Level 1 (CLI 接口 + init 集成)

---

## TC-1-01: mumuspec env detect 基础输出

**Given**: 系统安装了 Node.js
**When**: 运行 `mumuspec env detect`
**Then**:
- 输出包含 OS 信息行
- 输出包含 Node 生态工具信息
- 输出包含 Result 摘要行
- 退出码为 0

---

## TC-1-02: mumuspec env detect --json

**Given**: 系统安装了 JDK 17
**When**: 运行 `mumuspec env detect --json`
**Then**:
- 输出合法 JSON
- JSON 符合 `EnvironmentDetection` schema
- 包含 `os`, `tools`, `timestamp` 字段

---

## TC-1-03: mumuspec env detect --ecosystem

**Given**: 系统安装了 Java 和 Node
**When**: 运行 `mumuspec env detect --ecosystem java`
**Then**:
- 输出仅包含 Java 生态工具
- Node.js 工具不显示

---

## TC-1-04: mumuspec env detect --save

**Given**: 项目目录存在，系统安装了 Node.js
**When**: 运行 `mumuspec env detect --save`
**Then**:
- 创建 `.mumuspec/env-spec.md` 文件
- frontmatter 包含 `type: environment`
- Detected 部分包含 Node.js 信息

---

## TC-1-05: mumuspec env validate 通过

**Given**: `env-spec.md` 声明需要 Node.js 18+，系统安装 Node.js 24
**When**: 运行 `mumuspec env validate`
**Then**:
- 输出 "All checks passed"
- 退出码为 0

---

## TC-1-06: mumuspec env validate 缺失工具

**Given**: `env-spec.md` 声明需要 Maven，系统未安装
**When**: 运行 `mumuspec env validate`
**Then**:
- 输出缺失工具信息
- 退出码为 2

---

## TC-1-07: mumuspec env validate 版本不匹配

**Given**: `env-spec.md` 声明需要 JDK 17+，系统安装 JDK 8
**When**: 运行 `mumuspec env validate`
**Then**:
- 输出版本不匹配警告
- 退出码为 1（warning）

---

## TC-1-08: mumuspec env validate 无 env-spec.md

**Given**: 项目目录不存在 `env-spec.md`
**When**: 运行 `mumuspec env validate`
**Then**:
- 输出错误提示："env-spec.md not found"
- 提示先运行 `--save`
- 退出码为 3

---

## TC-1-09: mumuspec env diff

**Given**: 当前系统的环境检测结果与已保存的 `env-spec.md`
**When**: 运行 `mumuspec env diff`
**Then**:
- 输出版本差异（如有）
- 输出新增/缺失的工具

---

## TC-1-10: mumuspec env diff --against

**Given**: 存在另一个环境的 `env-spec-backup.md`
**When**: 运行 `mumuspec env diff --against env-spec-backup.md`
**Then**:
- 对比两环境工具版本差异
- 输出版本升级/降级信息

---

## TC-1-11: mumuspec env validate --strict

**Given**: `env-spec.md` 声明需要 Node.js 18+，系统安装 Node.js 20（有微小差异）
**When**: 运行 `mumuspec env validate --strict`
**Then**:
- 严格模式下 warning 升级为 error
- 退出码为 2

---

## TC-1-12: mumuspec init 集成环境检测

**Given**: 运行 `mumuspec init` 于 Java 项目（存在 pom.xml）
**When**: 初始化完成
**Then**:
- 生成 `.mumuspec/env-spec.md`
- Detected 部分包含 Java 生态工具信息
- 知识库新增环境相关知识页

---

## TC-1-13: mumuspec init 无检测

**Given**: 运行 `mumuspec init` 于空项目（无配置文件）
**When**: 初始化完成
**Then**:
- 不生成 env-spec.md 或仅生成基础模板
- 整体初始化流程不中断

---

## TC-1-14: 跨平台兼容（Windows）

**Given**: Windows 系统运行检测
**When**: 调用 `detectTool('jdk', config)`
**Then**:
- 使用 `where` 而非 `which` 检测位置
- 路径分隔符为 `\`

---

## TC-1-15: 跨平台兼容（Linux/macOS）

**Given**: Linux/macOS 系统运行检测
**When**: 调用 `detectTool('jdk', config)`
**Then**:
- 使用 `which` 检测位置
- 路径分隔符为 `/`
