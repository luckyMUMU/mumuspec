# Delta Spec: src/api

## 变更内容

### 修改 Requirement: 路由分发

#### 修改 SHALL
- 原: 路由匹配后必须调用 storage 层函数处理数据
- 改: 路由匹配后必须调用 storage 层函数处理数据，POST/PATCH 请求必须将 priority 传递给 storage 层

#### 无新增 SHALL NOT
- priority 字段是可选的，不需要新的禁止约束
