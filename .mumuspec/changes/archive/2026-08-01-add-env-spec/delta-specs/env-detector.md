---
id: "ENV-001"
title: "环境检测器 — 核心检测逻辑"
scope: "src/core/env-detector.ts"
type: "shall"
layer: 0
---

## SHALL

新增环境检测器模块，自动识别并记录开发工具和运行时位置。

### 检测范围

| 生态 | 检测项 | 检测方式 | 输出字段 |
|------|--------|----------|----------|
| Java | JDK | `java -version`, `JAVA_HOME` | version, location, vendor |
| Java | Maven | `mvn -version`, `which mvn` | version, location, m2_home |
| Java | Gradle | `gradle -version`, `which gradle` | version, location, gradle_home |
| Node | Node.js | `node --version`, `which node` | version, location, npm_root |
| Node | Package Manager | `npm/pnpm/yarn --version` | name, version, global_path |
| Python | Python | `python --version`, `which python` | version, location, pip_version |
| Python | Virtual Env | `conda/pipenv/poetry --version` | name, version |
| OS | System | `process.platform`, `os.release()` | type, arch, version |

### API

```typescript
// 核心检测接口
export interface EnvironmentDetection {
  timestamp: string;
  os: OSInfo;
  tools: DetectedTool[];
  missing: string[];
  warnings: string[];
}

export interface DetectedTool {
  name: string;
  ecosystem: 'java' | 'node' | 'python' | 'build' | 'os';
  version: string;
  location: string;
  envVars: Record<string, string>;
}

// 主检测函数
export function detectEnvironment(options?: {
  ecosystems?: string[];
  cache?: boolean;
}): Promise<EnvironmentDetection>;

// 单项检测
export function detectTool(name: string): Promise<DetectedTool | null>;
```

### 性能要求

- 全量检测必须在 2 秒内完成
- 使用并行检测（`Promise.all`），而非串行
- 每个子检测有 1 秒超时，超时视为工具未安装

## Reason

环境信息是开发和 CI/CD 的基础设施，结构化记录可减少"环境差异"导致的构建失败。
