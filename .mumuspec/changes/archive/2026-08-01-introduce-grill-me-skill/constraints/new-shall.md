# 新增 SHALL 约束

## grill-me 引入约束

| ID | 约束 | 理由 |
|----|------|------|
| SHALL-GM-001 | grill-me 步骤 SHALL 在认知框架收敛后、Hyperplan 前执行 | 确保设计在进入多角色对抗前已通过单用户深度验证 |
| SHALL-GM-002 | grill-me 每次 SHALL 只问 1 个问题，等用户回答后再继续 | 核心机制，避免批量填问卷式回答 |
| SHALL-GM-003 | grill-me 问题 SHALL 附带 2-4 个选项（含 Agent 推荐标记） | 降低用户决策负担 |
| SHALL-GM-004 | 可通过代码库/文档自查的事实 SHALL NOT 询问用户 | 事实与决策分离原则 |
| SHALL-GM-005 | grill-me 上限 SHALL 为 10 轮 | 防止无限追问导致用户疲劳 |
| SHALL-GM-006 | grill-me 完成后 SHALL 写入 cognitive-map.yaml | 产出可追踪可验证 |
| SHALL-GM-007 | 用户 SHALL 能随时显式声明"已达成共识"退出追问 | 用户自主控制 |
| SHALL-GM-008 | grill-me deferred 项 SHALL 写入 Q4 残留并标注为 deferred | 确保不遗漏未解决问题 |
| SHALL-GM-009 | grill-me completed 标志 SHALL 纳入 Phase Guard 检查 | 不完成不能进入 Build |
| SHALL-GM-010 | grill-me 决策记录 SHALL 在 Archive 阶段被提取为 Knowledge Page | 知识沉淀 |
