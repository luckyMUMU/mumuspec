# build-and-install.ps1 — Bump version, sync CLI version, build, and install locally.
#
# Usage:
#   .\scripts\build-and-install.ps1              # default: bump alpha
#   .\scripts\build-and-install.ps1 -Tag beta    # bump beta
#   .\scripts\build-and-install.ps1 -Tag rc     # bump rc
#   .\scripts\build-and-install.ps1 -Patch      # bump patch (no prerelease tag)
#   .\scripts\build-and-install.ps1 -Minor      # bump minor
#   .\scripts\build-and-install.ps1 -Major      # bump major
#   .\scripts\build-and-install.ps1 -SkipBump   # skip version bump, just build + install

param(
    [ValidateSet('alpha', 'beta', 'rc')]
    [string]$Tag = 'alpha',
    [switch]$Patch,
    [switch]$Minor,
    [switch]$Major,
    [switch]$SkipBump
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Step([string]$msg) {
    Write-Host ''
    Write-Host '══════════════════════════════════════════════════════════' -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host '══════════════════════════════════════════════════════════' -ForegroundColor Cyan
}

# ── Step 1: Version Bump ──
if (-not $SkipBump) {
    Step 'Step 1: Bumping version'
    
    if ($Patch) {
        npm version patch --no-git-tag-version
    } elseif ($Minor) {
        npm version minor --no-git-tag-version
    } elseif ($Major) {
        npm version major --no-git-tag-version
    } else {
        node scripts/bump-prerelease.mjs $Tag
    }
}

# ── Step 2: Sync CLI version ──
Step 'Step 2: Syncing CLI version with package.json'
$pkg = Get-Content "$Root\package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version
$cliIndex = Get-Content "$Root\src\cli\index.ts" -Raw
$cliIndex = $cliIndex -replace '\.version\([''"][^''"]+[''"]\)', ".version('$ver')"
Set-Content "$Root\src\cli\index.ts" $cliIndex -NoNewline
Write-Host "  CLI version synced -> $ver"

# ── Step 3: Prebuild check ──
Step 'Step 3: Running prebuild check'
node scripts/prebuild-check.mjs
if ($LASTEXITCODE -ne 0) { throw 'Prebuild check failed' }

# ── Step 4: Build ──
Step 'Step 4: Building TypeScript'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

# ── Step 5: Install locally ──
Step 'Step 5: Installing locally (npm install -g)'
npm install -g "$Root"
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }

# ── Step 6: Verify ──
Step 'Step 6: Verifying installation'
$installedVersion = mumuspec --version
Write-Host ""
Write-Host "  Installed: mumuspec v$installedVersion" -ForegroundColor Green
Write-Host ""
Write-Host "  Commands available:"
$helpOutput = mumuspec --help 2>&1
$helpOutput | Select-String '^\s+(\w[\w-]*)' | ForEach-Object {
    $cmd = $_.Line.Trim().Split(' ')[0]
    Write-Host "    - $cmd"
}
Write-Host ""
Write-Host '══════════════════════════════════════════════════════════' -ForegroundColor Green
Write-Host "  Build & Install Complete: v$installedVersion" -ForegroundColor Green
Write-Host '══════════════════════════════════════════════════════════' -ForegroundColor Green
