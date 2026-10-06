# play-store-deploy.ps1
# Full Play Store Deployment Pipeline with Auto-Versioning

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "beta", "alpha", "internal")]
    [string]$Track = "production"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Google Play Store Automated Pipeline" -ForegroundColor Cyan
Write-Host "Track: $Track"
Write-Host "=========================================`n" -ForegroundColor Cyan

# 1. Capacitor Sync
Write-Host "🔄 Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Capacitor sync failed!" -ForegroundColor Red
    exit 1
}

# 2. Version Bumping
$BuildGradlePath = Join-Path $PSScriptRoot "..\android\app\build.gradle"
$GradleContent = Get-Content $BuildGradlePath

# Find current version code
$CurrentCodeLine = $GradleContent | Select-String -Pattern "versionCode\s+(\d+)"
if ($CurrentCodeLine.Matches.Count -gt 0) {
    $CurrentCode = [int]$CurrentCodeLine.Matches[0].Groups[1].Value
    $NewCode = $CurrentCode + 1
} else {
    Write-Host "❌ Could not find versionCode in build.gradle" -ForegroundColor Red
    exit 1
}

# Find current version name
$CurrentNameLine = $GradleContent | Select-String -Pattern 'versionName\s+"([^"]+)"'
if ($CurrentNameLine.Matches.Count -gt 0) {
    $CurrentName = $CurrentNameLine.Matches[0].Groups[1].Value
} else {
    Write-Host "❌ Could not find versionName in build.gradle" -ForegroundColor Red
    exit 1
}

Write-Host "Current Version Code: $CurrentCode"
Write-Host "Current Version Name: $CurrentName"

$InputName = Read-Host "Enter new Version Name (Press Enter to keep $CurrentName)"
if ([string]::IsNullOrWhiteSpace($InputName)) {
    $NewName = $CurrentName
} else {
    $NewName = $InputName
}

# Replace in file
$GradleContent = $GradleContent -replace "versionCode\s+$CurrentCode", "versionCode $NewCode"
$GradleContent = $GradleContent -replace 'versionName\s+"([^"]+)"', "versionName `"$NewName`""
Set-Content -Path $BuildGradlePath -Value $GradleContent
Write-Host "✅ Updated build.gradle to versionCode: $NewCode, versionName: $NewName`n" -ForegroundColor Green

# 3. Release Notes Prompt
Write-Host "📝 Play Store Release Notes" -ForegroundColor Yellow
$ReleaseNotes = Read-Host "What's new in this release?"
if ([string]::IsNullOrWhiteSpace($ReleaseNotes)) {
    $ReleaseNotes = "Performance improvements and bug fixes."
}

# Ensure directory exists
$ReleaseNotesDir = Join-Path $PSScriptRoot "..\android\app\src\main\play\release-notes\en-US"
if (-not (Test-Path $ReleaseNotesDir)) {
    New-Item -ItemType Directory -Force -Path $ReleaseNotesDir | Out-Null
}
$ReleaseNotesPath = Join-Path $ReleaseNotesDir "default.txt"
Set-Content -Path $ReleaseNotesPath -Value $ReleaseNotes -Encoding UTF8
Write-Host "✅ Release notes saved.`n" -ForegroundColor Green

# 4. Build and Push
$AndroidDir = Join-Path $PSScriptRoot "..\android"
Set-Location $AndroidDir

Write-Host "🚀 Building Signed Release Bundle and Pushing to Play Store..." -ForegroundColor Yellow
.\gradlew publishBundle

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Successfully uploaded version $NewName ($NewCode) to Google Play ($Track track)!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed. Please check the Gradle output above." -ForegroundColor Red
}

Set-Location $PSScriptRoot\..
