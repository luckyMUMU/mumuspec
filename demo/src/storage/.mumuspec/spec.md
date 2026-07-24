---
layer: 2
scope: "src/storage"
last_updated: "2026-07-10"
---

## Requirement: 内存存储

### SHALL
- 使用 Map<string, Task> 作为存储引擎
- 提供 create / read / update / delete / list 五个操作函数
- create 操作必须自动生成唯一 id（使用 crypto.randomUUID()）
- create / update 操作必须自动设置时间戳

### SHALL NOT
- 禁止在存储层做输入验证（由 models 层负责）
- 禁止在存储层引入响应码概念
- 禁止将存储实例暴露为全局变量（使用模块单例导出）

### Enforcement
- STORE-1: 检查使用 crypto.randomUUID() 而非第三方 uuid 库
- STORE-2: 检查存储函数不返回响应码
