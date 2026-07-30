---
type: lesson
id: KL-001
title: 正则表达式贪婪匹配 name= 与 filename= 的陷阱
scope: src/uploader.ts
created_at: "2026-07-29"
status: fresh
resolved: true
---

# 教训：Content-Disposition 头部解析的贪婪匹配陷阱

## 问题
原始正则 `/Content-Disposition:[^\r\n]*name="([^"]+)"/i` 会错误地将 `filename="test.jpg"` 匹配为 `name="test.jpg"`。

## 根因
`[^\r\n]*` 贪心匹配所有非换行字符，包括 `filename=` 中的 `name=` 子串。正则引擎找到输入中最后一个 `name="..."` 即停止。

## 复现

```
Content-Disposition: form-data; name="image"; filename="test.jpg"
                                       ↑ 正确  ↑ 也会被匹配
```

第一遍实现时 `disMatch[1]` 得到 `test.jpg`（来自 filename），而非 `image`。

## 解决方案

使用 tempered greedy token `(?:(?!name=).)*` 替代 `[^\r\n]*`：

```typescript
const dispMatch = headerStr.match(
  /Content-Disposition:(?:(?!name=).)*name="([^"]+)"(?:;\s*filename="([^"]*)")?/is
);
```

该模式确保匹配在第一个真正的 `name=` 处停止，不会跨越前方出现的 `filename=`。

## 适用范围
所有需要从类似 `name="x"; filename="y"` 格式的字符串中提取独立字段的场景。
