# Test Cases - Layer 1: phase-guard 完备性门禁挂钩

> 测试文件：`tests/completeness-gate.test.ts`
> 被测模块：`src/guard/phase-guard.ts`（改：design→build 与 build→verify 挂钩）
> 语义：双签 = LLM 起草（工件存在且非 open）+ 人签收（resolution 链落 decisions.md）；LLM advisory 结论不进 guard 判定路径。

## Cases

### TC-B2a: design→build，items 全 open 且无签收 → block
- **可验证性**: enforced-strong
- **Given**: 临时项目含合法 change（phase=design），`open-questions.yaml` 存在且所有 items `status: open`
- **When**: guard 检查 design→build 转换
- **Then**: 结果 = block；阻塞原因指向未消解的 open item（含 OQ id 列表）。

### TC-B2b: LLM advisory 字段声明"完备"不改变判定
- **可验证性**: enforced-strong
- **Given**: 同 TC-B2a，且工件中含 advisory 语义字段（如 `completeness: complete` 或任意自由文本完备声明）
- **When**: guard 检查 design→build
- **Then**: 仍 = block（advisory 字段被忽略；红线：禁止以自由文本声明设计完备来放行门禁）。

### TC-B2c: items 消解 + decision_ref 命中 → pass
- **可验证性**: enforced-strong
- **Given**: `open-questions.yaml` 所有 items status≠open 且 resolution.decision_ref 均可在 decisions.md 命中
- **Then**: design→build 门禁 pass（既有 BP 阻塞语义不变，仍按需 --confirm）。

### TC-B2d: 工件缺失的两分支
- **可验证性**: enforced-strong
- **分支 1**: `open-questions.yaml` 不存在且 design.md 未声明"无未决问题" → block（缺工件）
- **分支 2**: 工件不存在但 design.md 含显式声明标记（如一行 `<!-- no-open-questions -->`）→ 仍要求人工签收标记（decisions.md 存在对应条目）→ 命中则 pass，否则 block

### TC-B2e: build→verify 对 assumptions.yaml 同构生效
- **可验证性**: enforced-strong
- **Given**: phase=build，`assumptions.yaml` 含 open item
- **When**: guard 检查 build→verify
- **Then**: block；消解后 pass。与 TC-B2a/c 镜像。

### TC-B2f: 非法工件 → 拒绝执行而非降级（fail-closed）
- **可验证性**: enforced-strong
- **Given**: `open-questions.yaml` schema 非法（缺 version）
- **When**: guard 检查 design→build
- **Then**: block 且错误码 = E-CHANGE-020（guard 不消费非法工件 — KP-0060 公理 3）；不产生"跳过门禁"的 warning 放行。

## 边界与不变式
- 既有 guard 语义零回归：机械四分类一票否决、BP-3 阻塞、test-cases 检查行为不变。
- 门禁只增不改：新挂钩失败不绕过既有检查，两者取交集（任一 block 即 block）。
- guard 判定唯一依据 = 工件状态 + decisions.md 交叉断言；无 LLM 调用。
