---
layer: 0
scope: "."
last_updated: "2026-07-29"
---

# LAN Image Share — 反向禁止清单

## Module: All

### SHALL NOT — 运行时依赖
- 不允许安装任何生产依赖（package.json 中 dependencies 必须为空）
- 不允许使用 require/import 引入第三方 npm 包于 src/ 代码中
- 不允许为单一功能引入重型库（如用 lodash 替代一行原生代码）

### SHALL NOT — 路径安全
- 不允许将用户提供的原始文件名用于文件存储路径拼接
- 不允许 URL 参数中的 ID 包含 `.`、`/`、`\`、`%2e`、`%2f`（防止路径遍历）
- 不允许通过构造特殊 ID 读取 uploads/ 目录外的文件
- 不允许将 metadata.json 通过 HTTP 静态文件服务暴露

### SHALL NOT — 文件存储
- 不允许存储 MIME 类型不在白名单中的文件
- 不允许存储超过 50MB 的文件
- 不允许覆盖已存在的文件记录（除非显式删除后重新上传）
- 不允许用用户控制的文件名重命名存储文件

### SHALL NOT — API 行为
- 不允许 GET /api/images 返回未经验证的元数据
- 不允许缺少 MIME 校验就直接 savedBuffer 到磁盘
- 不允许已删除的图片 ID 返回 200 状态（应返回 404）
- 不允许 CORS 头缺失（必须包含 `Access-Control-Allow-Origin: *`）

### SHALL NOT — 代码组织
- 不允许 src/ 内部模块循环依赖
- 不允许超过 100 行的单个函数
- 不允许未注释的 "magic number"（必须用命名常量替代）
- 不允许使用 eval、Function 构造器、或动态代码执行

### SHALL NOT — 测试
- 不允许缺少断言的测试（任何 it/test 必须至少有一个 expect）
- 不允许测试依赖外部服务（网络/数据库）
- 不允许跳过规则 —— 所有测试默认运行，无 `.skip`
