# Design: portable-exe-packaging

## Architecture

### 一键启动 (scripts/start.mjs)
```
┌─────────────────────────────────────┐
│ start.mjs                           │
├─────────────────────────────────────┤
│ 1. 检测 node_modules 是否存在        │
│ 2. 不存在则自动 npm install          │
│ 3. 启动 backend (Express API)       │
│ 4. 启动 frontend (静态文件服务)      │
│ 5. 输出访问地址                      │
└─────────────────────────────────────┘
```

### Exe 打包 (scripts/build-exe.mjs)
```
┌─────────────────────────────────────┐
│ build-exe.mjs                       │
├─────────────────────────────────────┤
│ 1. 检测 Node.js 版本 >= 20          │
│ 2. 生成 sea-config.json            │
│ 3. 生成 blob: node --experimental-sea-config │
│ 4. 复制 node.exe + 注入 blob        │
│ 5. 输出到 dist/                     │
└─────────────────────────────────────┘
```

### 自包含运行时
```
┌─────────────────────────────────────┐
│ 运行时目录结构                       │
├─────────────────────────────────────┤
│ app.exe          ← 打包后的 exe      │
│ .app-data/       ← 运行时数据目录    │
│   ├── config/    ← 配置文件         │
│   ├── temp/      ← 临时文件         │
│   └── uploads/   ← 上传文件         │
└─────────────────────────────────────┘
```

## Implementation Layers

### Layer 0: 基础设施
- `scripts/start.mjs` — 一键启动
- `scripts/build-exe.mjs` — exe 打包

### Layer 1: 适配改造
- 修改 image-share 服务入口支持同目录数据写入
- 添加 `--data-path` 参数

## Test Strategy
- Layer 0: 验证 start.mjs 启动成功
- Layer 1: 验证 build-exe.mjs 生成可执行文件
