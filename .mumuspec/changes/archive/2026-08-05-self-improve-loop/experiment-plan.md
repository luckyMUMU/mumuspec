# Mumuspec 自改进对比实验方案

## 实验目标
通过多方向对比实验，发现 mumuspec 的有价值改进特性

## 3 个改进方向

### 方向 A: 增强 Drift 检测（自动修复建议）
- 在 drift 检测基础上增加 `--fix` 自动修复选项
- 提供修复预览（dry-run）模式
- 智能推断修复策略

### 方向 B: 优化 Worktree 生命周期管理
- 自动清理已归档/已合并的 worktree
- worktree 复用机制（同分支复用）
- 统一的 worktree list/status 展示

### 方向 C: 改进 CLI 交互体验
- 添加进度条和状态指示
- 更友好的错误提示和恢复建议
- 交互式的脏 worktree 处理向导

## 标准化测试用例

对每个方向执行相同的变更流程：
1. `mumuspec new test-feature` — 创建新变更
2. `mumuspec state transition test-feature design --confirm` — 设计
3. 创建简单的代码文件（如 `src/utils.ts` 含 2-3 个函数）
4. `mumuspec state transition test-feature build --confirm` — 构建
5. `mumuspec check` — 运行验证
6. `mumuspec state transition test-feature verify --confirm` — 验证
7. `mumuspec state transition test-feature archive-in-progress --confirm` — 归档

## 观察维度
1. 命令执行耗时
2. 出错恢复便捷性
3. 信息展示清晰度
4. 自动化程度
5. 用户确认次数

## 对比输出格式
每个方向完成后输出：执行步骤耗时、遇到的问题、改进亮点、是否推荐引入
