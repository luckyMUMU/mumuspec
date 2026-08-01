# Delta Spec: Phase Guard 检查项更新

> 类型: MODIFIED | 范围: design_to_build 守卫

---

## MODIFIED: design_to_build 守卫

在现有检查项中追加：

```yaml
# 新增检查项（追加到 design_to_build 守卫）
- grill_me_completed: true
- grill_me_rounds <= 10
- grill_me_deferred_count documented  # 有记录未解决的问题
```

## MODIFIED: cognitive-map.yaml schema

```yaml
# cognitive-map.yaml 追加字段
grill_me:
  completed: false
  rounds: 0
  deferred_count: 0
  consensus_reached: false
  entries:
    - id: "GM-001"
      question: "..."
      answer: "..."
      status: "confirmed"  # confirmed | rejected | deferred
      timestamp: "..."
```
