# 发布与回滚策略

> 层级: Level 2 参考文档

---

## 1. 版本策略

采用 SemVer：`MAJOR.MINOR.PATCH`

| 版本类型 | 触发条件 | 示例 |
|---------|---------|------|
| MAJOR | 不兼容的规范格式变更、配置 schema 变更 | 0.x → 1.0 |
| MINOR | 新功能、新 Phase 交付、向后兼容 | 0.7.0 → 0.8.0 |
| PATCH | Bug 修复、文档修正、性能优化 | 0.8.0 → 0.8.1 |

### Pre-release 标签

| 标签 | 含义 | 目标用户 |
|------|------|---------|
| `-alpha.N` | 内部测试 | 核心团队 |
| `-beta.N` | 邀请测试 | 早期采用者 |
| `-rc.N` | 发布候选 | 公开测试 |
| `-draft` | 设计草案（当前阶段） | 仅文档 |

---

## 2. 发布流程

```
1. 完成 Phase DoD 验收
2. 更新 CHANGELOG.md
3. 运行 `npm version <type>` 生成 tag
4. `npm publish --tag next`（先发 next 标签）
5. 邀请测试者验证（至少 2 个项目）
6. `npm dist-tag add @mumuspec/cli@<version> latest`（正式发布）
7. 发布 Release Notes（GitHub Releases）
8. 更新文档站点
```

### 发布前检查清单

- [ ] 所有 P0 优先级功能完成
- [ ] Phase DoD 验收通过
- [ ] CHANGELOG.md 已更新
- [ ] 版本号符合 SemVer 规则
- [ ] 至少在 2 个项目中验证通过
- [ ] 文档已同步更新
- [ ] 回滚方案已确认

---

## 3. 灰度策略

| 阶段 | 范围 | 持续时间 | 通过标准 |
|------|------|---------|---------|
| Canary | 核心团队 2-3 项目 | 3 天 | 无 CRITICAL bug |
| Beta | 邀请 5-10 个早期用户 | 1 周 | 无 MAJOR bug，成功率 ≥ 90% |
| RC | 公开 `npm install @mumuspec/cli@rc` | 3 天 | 无新 bug 报告 |
| Stable | `npm install @mumuspec/cli@latest` | — | — |

### 灰度阶段回退标准

| 严重级别 | 灰度阶段 | 处理方式 |
|---------|---------|---------|
| CRITICAL | Canary | 立即回退，修复后重新进入 Canary |
| CRITICAL | Beta | 立即回退，修复后重新进入 Canary |
| MAJOR | Beta | 延长 Beta 周期，修复后继续 Beta |
| MAJOR | RC | 延长 RC 周期，修复后继续 RC |
| MINOR | 任意 | 记录为已知问题，下个 PATCH 修复 |

---

## 4. 回滚方案

### CLI 回滚

```bash
# 回滚到上一个稳定版本
npm install -g @mumuspec/cli@<previous-stable>

# 或指定版本
npm install -g @mumuspec/cli@0.7.0
```

### 配置迁移回滚

| 场景 | 回滚方法 |
|------|---------|
| config.yaml schema 变更 | MumuSpec 内置 `mumuspec migrate --rollback --from <ver> --to <ver>` |
| .mumuspec.yaml 字段变更 | 向后兼容追加；删除字段前标注 deprecated 一个版本 |
| spec.md 格式变更 | 提供格式转换脚本 `mumuspec spec convert --from <ver>` |

### npm 包撤回

```bash
# 撤回版本（72 小时内）
npm unpublish @mumuspec/cli@<version>

# 或标记为 deprecated
npm deprecate @mumuspec/cli@<version> "Critical bug: <description>. Use <stable-version> instead."
```

### 变更回滚（运行时）

当 CLI 版本回滚导致 `.mumuspec.yaml` 格式不兼容时：

1. `mumuspec migrate --rollback --from <new> --to <old>` — 自动迁移配置格式
2. 若迁移失败，手动编辑 `.mumuspec.yaml` 删除新增字段
3. Git 回退规范文件到兼容版本

---

## 5. 兼容性保障

| 变更类型 | 兼容性策略 | 旧版本保留周期 |
|---------|-----------|---------------|
| config.yaml 新增字段 | 默认值兼容，旧配置无需修改 | — |
| config.yaml 删除字段 | 标注 deprecated，保留 1 个版本周期 | 1 个 MINOR |
| CLI 命令变更 | 旧命令标注 deprecated，保留 1 个版本周期 | 1 个 MINOR |
| spec.md 格式变更 | 提供自动转换脚本 | 永久（脚本支持） |
| .mumuspec.yaml schema 变更 | `mumuspec migrate` 自动迁移 | 永久（迁移脚本支持） |
| 错误码新增 | 向后兼容，新增错误码不影响现有处理 | — |
| 错误码废弃 | 标注 deprecated，保留 2 个版本周期 | 2 个 MINOR |

### Breaking Change 处理流程

1. **评估**: 确认为 Breaking Change，需 MAJOR 版本升级
2. **通知**: 在 CHANGELOG.md 中标注 `BREAKING CHANGE`
3. **迁移工具**: 提供自动化迁移脚本
4. **过渡期**: 旧功能标注 deprecated，至少保留 1 个 MAJOR 版本
5. **移除**: 在下一个 MAJOR 版本中移除旧功能

---

> **导航**: [← 错误码参考](error-codes.md) | [配置参考 →](configuration.md) | [返回概览](../overview.md)
