# Decision Log: spec-conformance-fix


## [open] 2026-09-17T15:36:00.753Z

不拆分：六项修复同源于一次规范面审计，且 B1（规范文本）与 B2（引擎不变量）互为前提——B1 把权威源改为引用校验器后，B2 补上的覆盖范围才可被规范文本正确描述。scope 取根目录，因改动面横跨根 spec.md、src/change 与仓库根工件。workflow 取 full：改动文件数超过 4 且含规范文本变更，hotfix 与 tweak 均不适用。

## [open] 2026-09-17T15:36:01.926Z

伴随能力降级（B 面技能集不含这三个包）：brainstorming → Fallback A，改用结构化提问两轮共 4 问；gitnexus-impact-analysis → Fallback B，改用 grep 与代码阅读手动分析，产出 impact-analysis.json；using-git-worktrees → Fallback C，isolation 保持 branch，不创建 worktree。

## [open] 2026-09-17T15:36:03.043Z

知识加载与契约检查：契约面扫描 0 契约、0 漂移，无 REMOVED 操作影响下游。审计误报撤回——src/team 的 BOUNDARY.md 并非缺失，该文件位于模块根目录而非 .mumuspec 内，与 src/change、src/guard、src/install 同形；该修复项已从范围中移除。

## [open] 2026-09-17T15:36:04.142Z

B7 执行方式偏差：eval-corpus 并入 master 采用纯 ref 快进（git branch -f master feature/20260915/eval-corpus），未使用 --no-ff 合并提交。原因：本会话 git checkout master 在沙箱内被中断，批量删除 599 个工作区受控文件并留下 .git/index.lock，已用 git restore 从索引恢复。纯 ref 方式不触碰工作区，内容等价（15 个提交全部保留），代价是缺少一个合并提交记录。
