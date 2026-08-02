# release.ps1 — Full release pipeline: bump version, build, test, publish, install.
#
# Usage:
#   . .\scripts\release.ps1              # default: alpha prerelease
#   . .\scripts\release.ps1 -Tag alpha   # bump alpha, publish with --tag next
#   . .\scripts\release.ps1 -Tag beta    # bump beta, publish with --tag next
#   . .\scripts\release.ps1 -Tag rc      # bump rc, publish with --tag next
#   . .\scripts\release.ps1 -Patch       # bump patch, publish with --tag latest
#   . .\scripts\release.ps1 -Minor       # bump minor, publish with --tag latest
#   . .\scripts\release.ps1 -Major       # bump major, publish with --tag latest
#   . .\scripts\release.ps1 -SkipBump    # skip version bump, build + test + publish + install
#   . .\scripts\release.ps1 -DryRun      # build + test only (no publish, no install)

param(
    [ValidateSet('alpha', 'beta', 'rc')]
    [string]$Tag = 'alpha',
    [switch]$Patch,
    [switch]$Minor,
    [switch]$Major,
    [switch]$SkipBump,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Step([string]$msg) {
    Write-Host ''
    Write-Host '----------------------------------------------------------' -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host '----------------------------------------------------------' -ForegroundColor Cyan
}

function RunCmd([string]$cmd) {
    Write-Host "  > $cmd" -ForegroundColor DarkGray
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (exit code $LASTEXITCODE): $cmd"
    }
}

# ── Step 1: Version Bump ──
if (-not $SkipBump) {
    Step 'Step 1: Version bump'
    if ($Patch) {
        RunCmd 'npm version patch --no-git-tag-version'
    } elseif ($Minor) {
        RunCmd 'npm version minor --no-git-tag-version'
    } elseif ($Major) {
        RunCmd 'npm version major --no-git-tag-version'
    } else {
        RunCmd "node scripts/bump-prerelease.mjs $Tag"
    }
}

# Read current version
$pkg = Get-Content "$Root\package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version
Write-Host "  Current version: $ver" -ForegroundColor Yellow

# Determine npm publish tag (prerelease -> next, stable -> latest)
$isPrerelease = $ver -match '-'
$publishTag = if ($isPrerelease -and -not $Patch -and -not $Minor -and -not $Major) { 'next' } else { 'latest' }
Write-Host "  Publish tag: $publishTag" -ForegroundColor Yellow

# ── Step 2: Sync CLI version ──
Step 'Step 2: Sync CLI version in src/cli/index.ts'
$cliIndex = Get-Content "$Root\src\cli\index.ts" -Raw
$cliIndex = $cliIndex -replace '\.version\([''"][^''"]+[''"]\)', ".version('$ver')"
Set-Content "$Root\src\cli\index.ts" $cliIndex -NoNewline
Write-Host "  Synced -> $ver"

# ── Step 3: Prebuild check ──
Step 'Step 3: Prebuild check'
RunCmd 'node scripts/prebuild-check.mjs'

# ── Step 4: Build ──
Step 'Step 4: TypeScript build'
RunCmd 'npm run build'

# ── Step 5: Test ──
Step 'Step 5: Running tests'
RunCmd 'npm test'

if ($DryRun) {
    Write-Host ''
    Write-Host '  DRY RUN complete. Build + test OK.' -ForegroundColor Green
    Write-Host "  Version: $ver (tag: $publishTag)" -ForegroundColor Green
    Write-Host '  No publish, no install.' -ForegroundColor Green
    return
}

# ── Step 6: Publish to npm ──
Step "Step 6: npm publish (--tag $publishTag)"
# Use --ignore-scripts to avoid re-running tests inside prepublishOnly hook.
# Tests already passed in Step 5.
RunCmd "npm publish --tag $publishTag --ignore-scripts"

# ── Step 7: Global install ──
Step 'Step 7: Global install (npm install -g)'
RunCmd "npm install -g `"$Root`""

# ── Step 8: Verify ──
Step 'Step 8: Verify'
$installedVer = mumuspec --version
Write-Host ''
Write-Host "  Installed: mumuspec v$installedVer" -ForegroundColor Green

# Check if installed version matches expected
if ($installedVer -eq $ver) {
    Write-Host "  Version match OK!" -ForegroundColor Green
} else {
    Write-Host "  Warning: expected v$ver but got v$installedVer" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '==========================================================' -ForegroundColor Green
Write-Host "  RELEASE COMPLETE: v$ver (tag: $publishTag)" -ForegroundColor Green
Write-Host '==========================================================' -ForegroundColor Green
