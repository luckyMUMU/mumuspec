# Test Cases: spec-context-projection (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 声明后只含清单区块（positive）

- 前置：tmp 项目 root tech.md 含 Requirement A、B、C，frontmatter `disclosure: [A]`。
- 步骤：`loadSpecContext`。
- 期望：`layer.tech.content` 含 A 块与 frontmatter，不含 B/C；`requirements` 仅 [A]。

## TC-L0-02 未声明逐字节回退（positive / 回归）

- 前置：无 disclosure 的 tech.md。
- 步骤：`loadSpecContext`。
- 期望：`content` 与源文件逐字节一致；`requirements` 全量。

## TC-L0-03 投影机械性（positive）

- 前置：declared 名不存在的 disclosure + 顶层非 Requirement section。
- 步骤：投影。
- 期望：未命中名 → 无该块；非 Requirement 顶层 section 被丢弃；无异常。