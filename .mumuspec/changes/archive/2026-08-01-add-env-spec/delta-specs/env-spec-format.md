---
id: "ENV-002"
title: "环境规范格式 — env-spec.md 文件结构"
scope: ".mumuspec/env-spec.md"
type: "shall"
layer: 0
---

## SHALL

新增环境规范文件格式 `.mumuspec/env-spec.md`，用于声明项目环境要求和记录实际检测结果。

### 文件格式

```yaml
---
layer: 0
scope: ".env"
type: environment
last_updated: "2026-08-01"
---

## Environment: <Category Name>

### SHALL
- <正向要求，如版本约束>
- <环境变量要求>

### SHALL NOT
- <反向禁止，如禁止全局安装>

### Detected
<自动填充，由 `mumuspec env detect --save` 生成>
- tool: <name>
  version: <version>
  location: <path>
  status: <ok | warn | missing>

### Notes
<手动补充的注意事项>
```

### 字段约束

- `type: environment` MUST 在 frontmatter 中标明
- `Detected` 部分 MUST 由工具自动生成，手动修改将在下次 `--save` 时被覆盖
- `SHALL` 和 `SHALL NOT` 部分可手动编辑，定义环境约束
- 工具未安装时 `status: missing`，不应阻断其他工具检测

### 应记录的核心组件

根据项目类型自动选择检测范围：

| 项目类型 | 必检项 | 可选项 |
|----------|--------|--------|
| java | JDK, Maven/Gradle | Docker, Make |
| typescript | Node.js | pnpm, yarn, vitest |
| python | Python, pip | conda, poetry |
| go | Go | — |
| rust | Rust, Cargo | — |

## Reason

结构化格式使环境约束可验证、可追踪、可对比，同时保持与现有 spec 系统的一致性。
