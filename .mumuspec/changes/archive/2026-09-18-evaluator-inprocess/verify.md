# Verify Report: evaluator-inprocess

## 验证结果：pass（全量验证）

| 检查 | 结果 |
|---|---|
| check（合规+漂移+术语，exit code） | 0 error；[drift] OK |
| validate（格式+Enforcement 覆盖） | 通过；371 约束 declared_ratio 100.0%，unverifiable=0 |
| test-cases verify（hash + 套件） | 通过（lock-suite，suites_locked=true，hash 88f0a18c20d7eb51） |
| guard verify | 通过（0 errors / advisory warnings） |
| lint / build | tsc --noEmit 0 error |
| 新增测试 | tests/core/metrics/evaluator-inprocess.test.ts(5) 全绿 |
| 全量回归 | tests/core/metrics + tests/eval（20 文件 337 例）全绿；data-source-contract（10）与 weight-single-source（6）按双通道契约更新后全绿 |

## Enforcement 覆盖（通道验证记录）

- INPROCESS_PRIMARY（ENF-1）：TC-L0-01（buildCheckJsonPayload 与 checkCompliance 逐字段一致 + exitCode 派生）、TC-L0-02（detectDriftInProcess 与 detectDrift 同源）、TC-L0-03（评估器 value∈[0,1]、weight=defaultWeight、rawData 字段不变）、TC-L0-04（metrics/eval 全量回归）→ tests/core/metrics/evaluator-inprocess.test.ts
- 子进程兜底通道契约（回归锁定）：data-source-contract / weight-single-source 以「in-process 抛错强制兜底」方式保留原 E17 解析语义（多行 JSON / status 非 0 含 payload / coverage 缺失 nullResult / spawn 失败 nullResult / win32 shell 标志）。

## 过程裁决记录

- in-process 为薄封装（buildCheckJsonPayload / detectDriftInProcess 直接复用 checkCompliance / detectDrift，无逻辑复刻），payload 契约逐字段对齐文档化 `check --json` 形状。
- 既有契约测试（data-source-contract / weight-single-source）原以「子进程唯一通道」为前提——B1 改为双通道后，用例经 checker 模块部分 mock（in-process 抛错）继续锁定兜底通道解析契约与 weight 不变量；主通道真实行为由 evaluator-inprocess.test.ts 直接验证。
- 指标 value 计算式、weight 引用、rawData 字段与 loop composite 收敛语义零改动。

## 分支处理

- 待归档：本机无 git（`git init` 无法执行），归档的分支提交/合并步骤需在 git 可用环境完成；按状态机 isolation=branch（mumuspec/evaluator-inprocess），归档时 git 步骤失败则按手动处理留痕。