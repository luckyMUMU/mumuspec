# Delta Spec: 行为门通道与标记剥离归一

## Requirement: 通道标记归一

判定入口 MUST 先剥离 ast:/lex: 通道标记再执行豁免与扫描路由，标记只影响分类来源，不改变执行路径。

### SHALL

- 豁免判定、agent 行为判定与词法扫描入口 SHALL 对带通道标记的文本与无标记原文给出同一执行路径。

### Enforcement

- ENF-1: enforced-strong(表驱动单测：带/不带前缀同路径等价断言，三类豁免各正反例)
- ENF-2: enforced-strong(语料断言：带 lex: 前缀的系统行为条目不产生词法误报)

## Requirement: behavior-gate 行为门通道

红线可声明由已注册门禁把守，声明本身经确定性指针核验；悬空指针是假强制，恒阻断。

### SHALL

- 声明 behavior-gate 注解的约束条目 SHALL 通过指针静态核验（错误码已注册且被至少一个语料声明命中，或 fixture 存在且声明非空）方可计入 enforced-strong。
- 指针核验失败 SHALL 发射 E-GUARD-013 且不可经 --force 越过。
- 行为门语义（核验门禁存在而非自行扫描违规）SHALL 在技术文档的契约变更节明示。

### SHALL NOT

- 禁止悬空的行为门指针进入强制面（无门禁把守而声称被把守）。
- 禁止行为门校验器执行子进程或引入新解析引擎（静态核验归注册表与语料清单）。

### Enforcement

- ENF-1: enforced-strong(单测：五态指针核验——通过/码未注册/码无语料/fixture 缺失/声明为空)
- ENF-2: enforced-strong(语料断言：悬空指针必命中 E-GUARD-013；合法指针零误报)
- ENF-3: manual(tech.md 契约变更节含 gate 语义区分表述，人工核对)
