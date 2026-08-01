# Layer 0 — 核心模块测试用例

> 类型: TDD 测试用例 | 层级: Level 0 (类型定义 + env-detector.ts 核心函数)

---

## TC-0-01: EnvironmentDetection 类型完整性

**Given**: 新类型 `EnvironmentDetection` 定义
**When**: TypeScript 编译
**Then**:
- EnvironmentDetection 包含 `timestamp`, `os`, `tools`, `missing`, `warnings`
- OSInfo 包含 `type`, `arch`, `version`, `envVars`
- DetectedTool 包含 `name`, `ecosystem`, `version`, `location`, `envVars`, `status`
- ToolEcosystem 支持 `'java' | 'node' | 'python' | 'go' | 'rust' | 'build' | 'container'`

---

## TC-0-02: EnvironmentSpec 类型完整性

**Given**: 新类型 `EnvironmentSpec` 和 `EnvSpecFile` 定义
**When**: TypeScript 编译
**Then**:
- EnvironmentSpec 包含 `tool`, `requirement`, `minVersion?`, `requiredEnvVars?`, `detected?`, `lastChecked?`
- EnvSpecFile 包含 `layer`, `scope`, `type`, `lastUpdated`, `environments`
- EnvSpecSection 包含 `category`, `shall`, `shallNot`, `detected`, `notes?`

---

## TC-0-03: detectEnvironment 基础功能

**Given**: 系统安装了 JDK 17 和 Node.js
**When**: 调用 `detectEnvironment()` 不指定 ecosystems
**Then**:
- 返回有效的 `EnvironmentDetection` 对象
- `os.type` 为 `'windows' | 'linux' | 'macos'` 之一
- `tools` 至少包含 jdk 和 node
- `timestamp` 为 ISO 格式
- 总耗时 < 2 秒

---

## TC-0-04: detectEnvironment 指定生态检测

**Given**: 系统安装了 JDK 17 和 Node.js
**When**: 调用 `detectEnvironment({ ecosystems: ['java'] })`
**Then**:
- `tools` 仅包含 java 生态工具（jdk、maven、gradle）
- Node.js 相关工具不在结果中

---

## TC-0-05: detectTool 单个工具检测（JDK）

**Given**: 系统安装了 JDK 17
**When**: 调用 `detectTool('jdk', DETECTOR_CONFIGS.jdk)`
**Then**:
- 返回 `DetectedTool` 对象
- `name` = 'jdk'
- `version` 匹配正则 `/17\.[\d.]+/`
- `status` = 'ok'
- `location` 非空（java 可执行文件路径）
- `envVars` 包含 `JAVA_HOME`（如果已设置）

---

## TC-0-06: detectTool 工具未安装

**Given**: 系统未安装 Gradle
**When**: 调用 `detectTool('gradle', DETECTOR_CONFIGS.gradle)`
**Then**:
- 返回 `status: 'missing'` 或 `null`
- 不抛出异常

---

## TC-0-07: detectTool 超时保护

**Given**: 工具检测命令阻塞（模拟 `sleep 10`）
**When**: 调用 `detectTool()` with timeout=1000
**Then**:
- 1 秒内返回
- `status` = 'missing'
- `warnings` 包含超时信息

---

## TC-0-08: 敏感变量过滤

**Given**: 环境变量包含 `MY_SECRET_TOKEN=abc` 和 `PATH=/usr/bin`
**When**: 调用 `filterSensitiveVars()`
**Then**:
- 输出不包含 `MY_SECRET_TOKEN`
- 输出包含 `PATH`
- 过滤规则覆盖 password/secret/token/key/credential/auth/private

---

## TC-0-09: detectRequiredEcosystems 推断

**Given**: 项目根目录存在 `pom.xml`
**When**: 调用 `detectRequiredEcosystems(projectRoot)`
**Then**:
- 返回数组包含 `'java'`

---

## TC-0-10: detectRequiredEcosystems 多项目

**Given**: 项目根目录存在 `package.json` 和 `pyproject.toml`
**When**: 调用 `detectRequiredEcosystems(projectRoot)`
**Then**:
- 返回数组包含 `'node'` 和 `'python'`

---

## TC-0-11: detectEnvironment 容错性

**Given**: 系统中某工具的命令不存在
**When**: 调用 `detectEnvironment()`
**Then**:
- 整体检测不因单个工具失败而中断
- 失败工具标记为 `status: 'missing'`
- 其他工具正常检测

---

## TC-0-12: 版本过低生成警告

**Given**: 系统安装的是 JDK 8（低于要求的 17）
**When**: 调用 `detectEnvironment()` 后执行版本检查
**Then**:
- jdk.status = 'warn'
- warnings 包含版本过低信息
