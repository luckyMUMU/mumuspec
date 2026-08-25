# Delta Spec: src/models

## 变更内容

### 修改 Requirement: Task 数据模型

#### 新增 SHALL
- Task 接口必须包含 priority (TaskPriority) 字段
- TaskPriority 类型必须为 'low' | 'medium' | 'high' 联合类型
- validateTask 必须验证 priority 字段（可选，默认 'medium'）

#### 修改 SHALL
- 原: Task 接口必须包含 id (string)、title (string)、status (TaskStatus) 字段
- 改: Task 接口必须包含 id (string)、title (string)、status (TaskStatus)、priority (TaskPriority) 字段

#### 新增 Enforcement
- MODEL-3: 检查 TaskPriority 联合类型包含 low/medium/high
- MODEL-4: 检查 validateTask 验证 priority 值
