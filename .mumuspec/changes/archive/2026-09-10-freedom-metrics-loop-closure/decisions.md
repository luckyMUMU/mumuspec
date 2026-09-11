# Decision Log: freedom-metrics-loop-closure


## [open] 2026-09-10T12:05:04.055Z

范围裁定：2026-09-10 中间层复评提出的 G1-G4 四项全做（建议出口接通、度量口径扩展、信号进契约面、元数据漂移收口），用户在 open 阶段审查 proposal.md 与 delta-spec 后签收

## [design] 2026-09-10T12:05:14.475Z

签收 D1/D2：D1 建议出口采用三消费点纯透传（LoopEvaluation 字段 + MetricsSnapshot 持久化 + decisions advisory 条目），不新建建议管道；D2 新增只读命令 mumuspec metrics [change] [--json]，明确反转前一变更不做清单中的'不新增 CLI 命令'——该决定依赖 AS-3，而 AS-3 已证伪（loop 通道未输出建议且天然排除 full 工作流）；只读性由绕开 autoEvaluate 的 recordProgress 副作用、改用纯采集函数 collectMetrics 保证

## [design] 2026-09-10T12:05:24.869Z

签收 D3/D4：D3 契约面 = metrics --json 结构化输出 + AGENTS.md 速查经命令注册表注入（不内联指标数据，Rules 文件受 32KiB 预算约束）；D4 元数据对齐以单元测试作为一致性校验器锁定（STATUS.md 版本 ↔ package.json、config.yaml 无遗留目标），不新建运行时校验器——避免再造无消费面的产出物

## [build] 2026-09-10T12:21:28.547Z

实现期裁决：为满足 ENF-3（metrics 须返回约束密度），修复 constraint-density 采集路径两处实现缺陷——(1) spawnSync('npx') 在 win32 上 ENOENT，加 shell: process.platform === 'win32'；(2) context --json 实际输出为多行美化 JSON，原实现只取首个 '{' 开头的行（即 '{' 本身）导致解析必然失败，改为从 stdout 首个 '{' 起切片解析。constraint-density 单测夹具同步改为多行 JSON，防止紧凑夹具再次掩盖该缺陷

## [verify] 2026-09-10T16:15:22.595Z

verify 结论 pass：tsc --noEmit 0 错误；受影响测试 8 文件/55 用例全 PASS；mumuspec validate 通过；mumuspec drift 无漂移。全量回归 4969 用例中 4968 PASS，唯一失败 cli-smoke 的 dogfooding 门槛源自既有 59 条 E-GUARD-003 违规（单一规则宽匹配），已用 config.yaml 回退对照证明计数与本次改动无关，且命中文件中的 3 行均为未触碰的既有代码

## [verify] 2026-09-10T16:15:29.275Z

实跑发现（记录不扩大范围）：constraint-density 采集路径此前从未采到任何值——spawnSync('npx') 在 win32 上 ENOENT，且 context --json 为多行美化 JSON 而采集器只取首个 '{' 开头的行；原单测的紧凑 JSON 夹具掩盖了后者。属 ENF-3 的前置条件，已随本变更修复

## [verify] 2026-09-10T16:15:35.971Z

环境限制（记录，不处理）：本环境无法创建嵌套 git ref（refs/heads/<a>/<b>），git checkout -b 静默失败导致变更分支 HEAD 进入 unborn。已通过 packed-refs 挂载 ref 恢复（ref 侧修复，未改仓库历史结构）。衍生缺陷：discard 当前所在分支会移除该分支 ref 而不回退 HEAD，后续 new 继承 unborn 状态；createBranch 返回值未被调用方检查，失败无感知。二者均属独立变更范畴
