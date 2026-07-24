# Decision Log: add-priority-field

## [open] 2026-07-10T12:00:00.000Z

创建变更 add-priority-field，为 Task 模型添加 priority 字段。

## [design] 2026-07-10T12:05:00.000Z

### D1: priority 默认值设为 'medium'
- **Context**: 需要确定 priority 字段的默认值
- **Decision**: 默认值 'medium'
- **Reasoning**: 中间值表示不偏不倚，符合常见优先级系统设计

### D2: 本次不实现 priority 排序
- **Context**: 是否在 list 接口中按 priority 排序
- **Decision**: 不实现排序，保持最小变更
- **Reasoning**: Ponytail 最小实现原则；排序可作为独立变更处理

### D3: 使用 TypeScript 联合类型而非 enum
- **Context**: 如何定义 TaskPriority 类型
- **Decision**: 使用联合类型 'low' | 'medium' | 'high'
- **Reasoning**: 与现有 TaskStatus 模式一致；联合类型在运行时无开销
