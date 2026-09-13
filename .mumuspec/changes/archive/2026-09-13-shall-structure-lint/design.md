# Design: shall-structure-lint

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

纯函数结构校验器 + validator 接线，机械检测约束文本中的无界限定词，输出 `W-SPEC-016` 告警。不做语义判定、不阻断（WARN），维持"完备 ≠ 正确"与"新告警一律 W-"纪律。

## G1: structure-lint.ts

```ts
export const VAGUE_QUALIFIERS = ['合理', '适当', '必要时', '尽量', '尽可能', '酌情', '视情况'] as const;

export interface StructureFinding {
  qualifiers: string[];  // 命中的无界词（去重，按词表序）
}

export function lintConstraintText(text: string): StructureFinding | null;
```

- 纯函数、无 I/O；词表为常量单一权威源（不得在消费者侧复制）。
- 匹配为子串包含（不做分词；误报率由词表保守性控制）。

## G2: validator 接线

- `validateAllSpecs` 中已有 `allItems: ClassifiedItem[]` 收集面；在其后新增一轮
  `emitStructureFindings(allItems, warnings)`：
  - 只检查 `cls` 对应条目文本（polarity 均查，SHOULD 不进 ClassifiedItem 天然排除）。
  - 命中 → `warnings.push({ code: 'W-SPEC-016', message: 'SHALL 文本含无界限定词 (Requirement "..."): "<text 截断 60>"', detail: `${source} [命中: 合理,适当]` })`。
- spec.md 与 tech.md 路径共用同一收集面 → 一处接线全覆盖。

## G3: errors.ts 注册

- `W-SPEC-016: STRUCTURE_VAGUE_QUALIFIER`，severity WARN，fixSteps 三条
  （改写为可判定动作 / 拆分为具体条件 / 如属必要模糊须在 Enforcement manual 说明核验方式），
  forceable: true。110 → 111 码，文档生成器自动可见。

## 决策点

- **WARN 不阻断**：初始词表覆盖面未知，先 advisory 观察噪音率；收紧为 ERROR 属契约变更，须评审。
- **不做主体缺失检测**：机械判定"可判定主体"易误报（中文句式多样），留待后续按噪音数据迭代。
- **词表不进配置**：词表是校验器实现细节，避免配置面膨胀；确需定制时走代码变更。

## 测试用例

1. TC1 各词逐一命中（7 词正例）→ lintConstraintText 返回对应词。
2. TC2 干净文本 → null；"适当地"前缀匹配也命中（子串语义）。
3. TC3 validator 集成：注入含"合理"的 SHALL（经 implicit-manual 落 R3）→ validate 产生 W-SPEC-016 且 detail 含命中词。
4. TC4 无界词在 SHALL NOT 同样触发；SHOULD 条目不触发。
