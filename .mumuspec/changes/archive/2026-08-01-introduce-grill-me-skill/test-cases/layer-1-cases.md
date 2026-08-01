# Test Cases: Layer 1 — 模块层（集成细节）

> 设计阶段锁定 | 版本: 0.14.0

---

## TC-101: 双文件同步修改

**前提**：Build 阶段修改 phase-design.md

**预期**：
- `.mumuspec/bundles/mumuspec-skills/phase-design.md` 更新
- `skills/phase-design.md` 同步更新
- 两份文件内容一致

**验证**：diff 检查两份文件 Step 2.5 内容相同

---

## TC-102: 预设路径跳过

**前提**：hotfix 或 tweak 工作流

**预期**：
- 不执行 grill-me 步骤
- `grill_me_result.completed` 不写入（或默认 false 且 guard 跳过）

**验证**：hotfix 变更无 grill_me 相关字段

---

## TC-103: cognitive-map.yaml Schema 兼容

**前提**：新旧版本 cognitive-map.yaml 互操作

**预期**：
- 新增 grill_me 字段不影响旧解析器
- 缺失字段时 grill_me 步骤正常完成（不惧哑值）

**验证**：schema validation 通过

---

## TC-104: Archive 阶段知识提取

**前提**：包含 grill-me 决策的变更进入 Archive

**预期**：
- grill_me entries (status=confirmed) 提取为 Knowledge Page
- 类型为 decision
- 自动关联 affected_scopes

**验证**：Archive 后 Knowledge Page 存在且内容正确
