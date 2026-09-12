# Decision Log: 2026-09-09-review-followup-hardening


## [design] 2026-09-09T15:28:48.857Z

open 阶段完成：proposal 定三工作流（W1 权重单一源 / W2 archive 幂等化 / W3 注册判定统一），均源于二评发现的双源/多源真相不一致；W1 采删除零消费者 map 方案，W2 采 rename 先行 + copy+delete 回退 + bump 幂等，W3 采共享判定函数

## [design] 2026-09-09T15:54:44.454Z

签收 OQ-1~3：D1 仅 bump 后置（merge/extract 原位，retry 安全）；D2 bump 幂等用 .mumuspec/.version-bumped 标记文件；D3 共享判定函数放 src/core/utils.ts

## [design] 2026-09-09T15:54:48.113Z

签收 AS-1~3：W1 破坏性删除可接受（0.x 语义）、cpSync 回退零新依赖、saveChangeState 不改

## [design] 2026-09-09T16:21:50.594Z

实现期裁决（build 阶段）：cli-smoke 门禁暴露 checker/verifier 动态执行 lexical 通道子串误判——includes('eval') 把上 CHG 合并的 SHALL NOT 中的 'evaluator' 误当动态执行禁令，假阳性标记 src/eval/runner.ts new Function。三处（checker.ts L725、verifier-classify.ts L80/L108）统一改为 \beval\b 词边界；新增 tests/guard/eval-word-boundary.test.ts 3 用例锁定
