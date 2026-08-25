# MumuSpec 反馈目录

本目录收集用户反馈与 AI Agent session 摘要,驱动 MumuSpec 迭代改进。

## 目录结构

```
feedback/
├── README.md                           # 本文件
├── user/                               # 用户提交的反馈
├── sessions/                           # AI Agent 自动生成的 session 摘要
├── monthly/                            # 月度聚合报告
└── _template/                          # 模板
    ├── user-feedback-template.md
    └── session-summary-template.md
```

## 提交反馈

### 用户反馈 (User Feedback)

1. 复制模板:
   ```bash
   cp feedback/_template/user-feedback-template.md \
      feedback/user/$(date +%Y-%m-%d)-<short-title>.md
   ```
2. 编辑内容,填写所有字段
3. 提交 PR:
   ```bash
   git checkout -b feedback/<short-title>
   git add feedback/user/
   git commit -m "feedback(user): <short title>"
   git push origin feedback/<short-title>
   ```

或直接在 GitHub 创建 Issue (使用 "User Feedback" 模板)。

### Session 摘要 (Session Summary)

AI Agent 在以下场景主动生成:
- 完成一次完整变更流程 (Open → Archive) 后
- 遇到 Phase Guard / Constraint 阻断后
- 执行回退 (rollback) 后
- 显式调用 `mumuspec session summary` 时 (Phase 2 实现)

```bash
cp feedback/_template/session-summary-template.md \
   feedback/sessions/$(date +%Y-%m-%d)-<short-title>.md
```

## 详细流程

参见 [docs/reference/feedback-process.md](../docs/reference/feedback-process.md)

## 隐私

- 默认公开 (开源仓库)
- 提交前删除:密钥、内部 URL、客户数据
- 用户反馈可匿名 (frontmatter `submitter: anonymous`)
- Session 摘要只记录 Agent 行为模式,不收集用户代码内容

## 月度聚合

每月 1 号维护者扫描本目录,提取共性模式到 `feedback/monthly/YYYY-MM.md`,并同步到 `docs/STATUS.md` §反馈汇总。
