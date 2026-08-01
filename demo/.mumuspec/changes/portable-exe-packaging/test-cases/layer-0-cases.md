# Layer-0 Test Cases: portable-exe-packaging

## TC-001: start.mjs 基础启动
**Given**: 项目目录存在，Node.js >= 20
**When**: 运行 `node scripts/start.mjs`
**Then**:
- 自动安装依赖（如果未安装）
- 自动构建 TypeScript
- 启动 http 服务在端口 3100
- 创建 .app-data/ 目录结构

## TC-002: start.mjs 自定义端口
**Given**: 项目目录存在
**When**: 运行 `node scripts/start.mjs --port 4000`
**Then**: 服务在端口 4000 启动

## TC-003: start.mjs 自定义数据目录
**Given**: 项目目录存在
**When**: 运行 `node scripts/start.mjs --data-dir /tmp/my-data`
**Then**: 数据文件在 /tmp/my-data/ 创建

## TC-004: build-exe.mjs 打包 exe
**Given**: TypeScript 构建成功，Node.js >= 20
**When**: 运行 `node scripts/build-exe.mjs`
**Then**:
- 生成 dist/image-share.exe（或平台对应的可执行文件）
- 文件大小 > 30MB（Node.js SEA 基本大小）

## TC-005: exe 自包含运行
**Given**: image-share.exe 已生成
**When**: 运行 `./image-share.exe`
**Then**:
- 服务正常启动
- 在 exe 同级目录创建 .app-data 目录
- 配置文件和上传文件存储在 .app-data/ 下

## TC-006: Node.js 版本检查
**Given**: Node.js < 20
**When**: 运行 `node scripts/start.mjs`
**Then**: 输出错误信息，提示需要 Node.js >= 20
