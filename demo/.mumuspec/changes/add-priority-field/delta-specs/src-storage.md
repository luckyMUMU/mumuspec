# Delta Spec: src/storage

## 变更内容

### 修改 Requirement: 内存存储

#### 修改 SHALL
- 原: create 操作必须自动生成唯一 id（使用 crypto.randomUUID()）
- 改: create 操作必须自动生成唯一 id（使用 crypto.randomUUID()），并接受可选 priority 参数

#### 新增 SHALL
- createTask 的 data 参数必须支持可选 priority 字段
- createTask 在未提供 priority 时必须默认使用 'medium'
