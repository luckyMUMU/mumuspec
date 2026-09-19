# land-lite-first.ps1 — 方案 A：一次性落地 lite-first 六变更（A1/A2/A3/B1/B2/B3）
#
# 背景：六变更均已在状态机归档（finalize-archive 已将 delta 并入主规范），
# 但开发期 git 不可用，导致：变更分支从未创建（mumuspec/<name> 不存在）、
# 全部实现代码未提交且叠加于 HEAD=feature/20260915/eval-corpus。
# 无法按变更追溯拆分提交（同名文件跨变更重叠），故以单一提交落地 master。
#
# 前提：本机已安装 git（下载 https://git-scm.com/download/win 后重新打开终端）。
# 用法：powershell -ExecutionPolicy Bypass -File scripts/land-lite-first.ps1
#
# 完成后仍需校正变更状态字段（受保护字段，按 E-STATE-001 流程人工审计留痕）：
#   1. mumuspec state set <change> <field> <value>（branch_status 等）
#   2. 或在 git 环境按状态机惯例提交 branch-status 修复变更。

$ErrorActionPreference = 'Stop'

function Fail($msg) {
  Write-Host "✗ $msg" -ForegroundColor Red
  exit 1
}

# 0. 前置校验
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail '未找到 git。请先安装 git（https://git-scm.com/download/win）并重新打开终端。'
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
  # 1. 确认仓库
  if (-not (Test-Path .git)) { Fail '当前目录不是 git 仓库。' }

  # 2. 确认在 master 上落地（当前 HEAD=feature/20260915/eval-corpus）
  $branch = (git symbolic-ref --short HEAD 2>$null)
  if ($LASTEXITCODE -ne 0 -or $branch -ne 'master') {
    Write-Host "当前分支: $branch → 切换到 master（未提交改动随 checkout 携带）"
    git checkout master 2>$null
    if ($LASTEXITCODE -ne 0) { Fail '切换到 master 失败（可能 master 与 feature 存在冲突）。请在 git 环境手工处理。' }
  }

  # 3. 提交全部未提交改动为单一落地提交
  git add -A
  if ($LASTEXITCODE -ne 0) { Fail 'git add 失败。' }
  $status = git status --porcelain
  if (-not $status) { Write-Host '工作区无待提交改动，已是最新。' }
  else {
    git commit -m "feat: lite-first 轻量路径主路径（A1 SHALL 机读通道 / A2 词法通道显式化 / A3 manual 显式化 / B1 评估器 in-process / B2 context 声明式投影 / B3 strength 建议值）"
    if ($LASTEXITCODE -ne 0) { Fail 'git commit 失败（请检查 pre-commit 钩子报错并修复后重试）。' }
  }

  # 4. 汇总
  Write-Host ''
  Write-Host '✓ 落地提交完成。当前 HEAD:'
  git log --oneline -3

  Write-Host ''
  Write-Host '后续（人工，git 环境）：按 E-STATE-001 流程校正六变更的 branch_status 字段，'
  Write-Host '或保留提交记录供审计，无需删除任何分支（本方案未创建分支）。'
}
finally {
  Pop-Location
}