---
id: KE-self-improvement-loop-p0-lessons
title: Lessons from self-improvement-loop-p0 decisions
type: lesson
status: confirmed
scope: self-improvement-loop-p0
created_at: 2026-09-12
tags:
  - auto-extracted
  - lesson
  - decisions
  - self-improvement-loop-p0
graph_bindings: []
---
> Auto-extracted from self-improvement-loop-p0/decisions.md

# Decision Log: self-improvement-loop-p0


## [design] 2026-09-12T05:53:14.710Z

签收 D1/D2：D1 P0-1 粒度采用相位聚合最小可行版本（GuardResult 只枚举失败、无通过清单，逐 error.code 记 passed:false 会让 passRate 恒 0 成镜像谎言），失败 code 归因与逐约束枚举推迟 P1、不扩展 CheckRecord；D2 落盘根解析到主工作区（MUMUSPEC_EVOLUTION_ROOT 优先，否则 git rev-parse --git-common-dir 推导主仓根，非 git 回退 projectRoot）

## [design] 2026-09-12T05:53:21.868Z

签收 D3/D4/D5：D3 P0-2 知识索引不可得时显式打印 knowledge index unavailable — skipped，不传空数组冒充无动作；D4 P0-4 区分副作用失败（提交失败 audit result:'fail' 并中断，错误详情入 error 字段）与只读采集失败（auto-eval 回退 manual 保留但补 audit 可追溯）；D5 P0-5 定性封存不补 commit（arm 差异是噪声，补 commit 等于让噪声获得可采纳通道），init 置 enabled=false、adopt 拒绝 exit 1、info 标注 experimental (未接通)，simulateChangeExecution/compute*Score 标注 simulated

## [build] 2026-09-12T06:20:01.323Z

build 完成：P0-1 guard 落盘相位聚合 CheckRecord + --force falsePositive（resolveEvolutionRoot 主仓根解析）；P0-2 meta-evolve 读真实 CheckRecord + 知识索引不可得显式声明；P0-3 --apply fail-closed exit 1；P0-4 loop-engine 副作用失败 audit result:fail 并中断、auto-eval 降级留 audit；P0-5 experiment init 置 enabled=false + adopt 拒绝 exit 1 + info/status 标注未接通 + simulated 标注。全量回归 5037 tests 全绿；mumuspec check exit 0；validate 通过
