# Cognitive Map 格式规范
# MumuSpec Guard 校验接受的唯一 YAML 格式

## Schema 定义

### 顶层结构
```yaml
entries:
  - quadrant: <Q1|Q2|Q3|Q4>
    category: <category>
    question: <string>
    answer: <string>
    confidence: <high|medium|low>
    source: <string>
```

### 各 quadrant 的额外字段

| Quadrant | category 可选值 | 额外必需字段 |
|----------|----------------|-------------|
| Q1 | `known-known`, `persistent` | — |
| Q2 | `known-unknown` | `options: [...]` (2-4 个选项) |
| Q3 | `reasoning` | `status: confirmed\|rejected\|modified` |
| Q4 | `blind-spot` | — |

### 必需 vs 可选字段

| 字段 | Q1 | Q2 | Q3 | Q4 |
|------|----|----|----|----|
| quadrant | ✓ | ✓ | ✓ | ✓ |
| category | ✓ | ✓ | ✓ | ✓ |
| question | ✓ | ✓ | ✓ | ✓ |
| answer | ✓ | ✓ | ✓ | ✓ |
| confidence | ✓ | ✓ | ✓ | ✓ |
| source | ✓ | ✓ | ✓ | ✓ |
| status | — | — | ✓ | — |
| options | — | ✓ | — | — |

### Guard 校验逻辑（基于 .mumuspec.yaml）

Guard **不直接解析 cognitive-map.yaml**，而是检查 `.mumuspec.yaml` 中的 `cognitive_framework` 字段：

```yaml
cognitive_framework:
  enabled: true
  q1_count: <Q1 entries 数量>
  q2_pending: <未回答的 Q2 数量>
  q3_pending: <未确认的 Q3 数量>
  q4_scans_completed: <Q4 扫描维度数量，需 >= 3>
  converged: <true|false>
  rounds_completed: <整数>
```

### 常见错误

| 错误信息 | 真正原因 | 修复方法 |
|---------|---------|---------|
| `E-DESIGN-001 cognitive-map.yaml 不存在` | 文件不在变更目录或 `.mumuspec.yaml` 的 `cognitive_framework.q1_count` 为 0 | 在 `.mumuspec.yaml` 中设置正确的 count 值 |
| `E-DESIGN-002 Q1 已知的已知为空` | `cognitive_framework.q1_count == 0` | 确保 Q1 entries 数量 > 0 |
| `E-DESIGN-005 Q4 扫描仅 0 个维度` | `cognitive_framework.q4_scans_completed < 3` | 至少添加 3 个 Q4 blind-spot entries |
| `E-DESIGN-006 认知地图未收敛` | `cognitive_framework.converged == false` | 设置 `converged: true` 且所有 pending 为 0 |

### 最小可工作示例

```yaml
entries:
  - quadrant: Q1
    category: known-known
    question: "技术栈？"
    answer: "Node.js 原生 http 模块"
    confidence: high
    source: "src/api/server.ts"

  - quadrant: Q2
    category: known-unknown
    question: "通信方式？"
    answer: "CORS 跨域"
    options: ["CORS 跨域", "同源代理"]
    confidence: high
    source: "user-confirmed"

  - quadrant: Q3
    category: reasoning
    status: confirmed
    question: "CORS 是否需要预检？"
    answer: "是，需 OPTIONS 方法响应 204"
    confidence: high
    source: "design-drill-down"

  - quadrant: Q4
    category: blind-spot
    question: "Windows 路径兼容？"
    answer: "pathToFileURL 替代字符串拼接"
    confidence: high
    source: "risk-scan"
```
