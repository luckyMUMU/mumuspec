# Test Cases - Layer 0

## Case 1: 创建带 priority 的 task
- **Input**: POST /tasks { "title": "Urgent task", "priority": "high" }
- **Expected**: 201, task.priority === "high"

## Case 2: 创建不带 priority 的 task（默认值）
- **Input**: POST /tasks { "title": "Normal task" }
- **Expected**: 201, task.priority === "medium"

## Case 3: 验证非法 priority
- **Input**: POST /tasks { "title": "Test", "priority": "urgent" }
- **Expected**: 400, error contains "priority must be one of"

## Case 4: 更新 priority
- **Input**: PATCH /tasks/:id { "priority": "low" }
- **Expected**: 200, task.priority === "low"

## Case 5: validateTask 接受合法 priority
- **Input**: validateTask({ title: "Test", priority: "high" })
- **Expected**: { valid: true, errors: [] }

## Case 6: validateTask 拒绝非法 priority
- **Input**: validateTask({ title: "Test", priority: "critical" })
- **Expected**: { valid: false, errors: ["priority must be one of: low, medium, high"] }

## Case 7: createTaskObject 设置默认 priority
- **Input**: createTaskObject({ title: "Test" })
- **Expected**: task.priority === "medium"
