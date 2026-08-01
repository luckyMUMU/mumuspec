# 新增 SHALL NOT 约束

## 性能
- SHALL NOT: post-commit hook SHALL NOT 阻塞提交流程（超时 500ms）
- SHALL NOT: 增量更新 SHALL NOT 重跑完整的 LLM 分析流水线
- SHALL NOT: `mumuspec impact` SHALL NOT 对未修改的代码节点触发全量分析

## 架构
- SHALL NOT: Dashboard GUI SHALL NOT 成为核心依赖（保持 CLI-first）
- SHALL NOT: Onboarding 命令 SHALL NOT 阻塞正常开发工作流
- SHALL NOT: 知识覆盖度分析 SHALL NOT 修改任何已有文件

## 兼容性
- SHALL NOT: 新增命令 SHALL NOT 破坏现有 `mumuspec knowledge` 命令的行为
- SHALL NOT: 提交消息 `Knowledge-Impact` 块 SHALL NOT 影响非 Mumuspec 用户的提交
- SHALL NOT: hook 安装 SHALL NOT 覆盖用户已有的非 Mumuspec hook
