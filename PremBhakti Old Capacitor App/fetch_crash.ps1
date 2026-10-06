<#
.SYNOPSIS
  Fetch recent Android crashes for Prem Bhakti from the Crashlytics BigQuery export.

.DESCRIPTION
  Queries the _REALTIME Crashlytics table (last N days only, to keep BigQuery scan
  cost low) and prints either crashes grouped by issue, or the most recent
  individual events. For each issue it shows the blamed file + line and the OS
  versions affected.

  Auth: if a folder-local gcloud login exists at .\.gcloud (created with
  $env:CLOUDSDK_CONFIG = "$PWD\.gcloud"; gcloud auth login), it is used for this
  script only; your global gcloud login is left untouched.

.EXAMPLE
  .\fetch_crash.ps1                     # latest version, grouped by issue
  .\fetch_crash.ps1 -Version 46         # a specific version (display_version)
  .\fetch_crash.ps1 -Version 46 -Events # recent individual events
  .\fetch_crash.ps1 -Days 3 -Type FATAL # only fatal crashes from last 3 days
#>
param(
	# application.display_version, e.g. "46" or "45.0.0". Default: latest build seen.
	[string]$Version,
	[ValidateRange(1, 30)][int]$Days = 7,
	[ValidateRange(1, 1000)][int]$Limit = 25,
	[ValidateSet("ALL", "FATAL", "NON_FATAL", "ANR")][string]$Type = "ALL",
	# Show individual recent events instead of grouping by issue.
	[switch]$Events
)

$ErrorActionPreference = "Stop"

$Project = "cpbs-admin"
$Table = "cpbs-admin.firebase_crashlytics.com_cpbs_bhajans_ANDROID_REALTIME"

if ($Version -and $Version -notmatch '^[0-9A-Za-z.\-]+$') {
	throw "Invalid -Version '$Version'. Use something like 46 or 45.0.0."
}

# Blamed frame first (what Crashlytics highlights), then the top exception frame,
# then the blamed thread's frame (ANRs / native crashes have no Java exception).
$frameExpr = @'
COALESCE(
      (SELECT AS STRUCT f.file, f.line, f.symbol FROM UNNEST(exceptions) e, UNNEST(e.frames) f WHERE f.blamed LIMIT 1),
      (SELECT AS STRUCT f.file, f.line, f.symbol FROM UNNEST(exceptions[SAFE_OFFSET(0)].frames) f WITH OFFSET o ORDER BY o LIMIT 1),
      (SELECT AS STRUCT f.file, f.line, f.symbol FROM UNNEST(threads) t, UNNEST(t.frames) f WHERE t.blamed AND f.blamed LIMIT 1)
    )
'@

$filters = @(
	"event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL $Days DAY)"
)
if ($Version) {
	$filters += "application.display_version = '$Version'"
} else {
	$filters += @"
application.display_version = (
      SELECT application.display_version FROM ``$Table``
      WHERE event_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL $Days DAY)
      GROUP BY 1 ORDER BY MAX(SAFE_CAST(application.build_version AS INT64)) DESC LIMIT 1)
"@
}
if ($Type -ne "ALL") {
	$filters += "error_type = '$Type'"
}
$where = $filters -join "`n  AND "

if ($Events) {
	$sql = @"
WITH base AS (
  SELECT *, $frameExpr AS frame
  FROM ``$Table``
  WHERE $where
)
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', event_timestamp, 'Asia/Kolkata') AS time_ist,
  application.display_version AS ver,
  error_type AS type,
  issue_title AS title,
  SUBSTR(issue_subtitle, 1, 110) AS subtitle,
  CONCAT(IFNULL(frame.file, '?'), ':', IFNULL(CAST(frame.line AS STRING), '?')) AS file_line,
  operating_system.display_version AS os,
  CONCAT(device.manufacturer, ' ', device.model) AS device,
  process_state AS state
FROM base
ORDER BY event_timestamp DESC
LIMIT $Limit
"@
} else {
	$sql = @"
WITH base AS (
  SELECT *, $frameExpr AS frame
  FROM ``$Table``
  WHERE $where
)
SELECT
  application.display_version AS ver,
  error_type AS type,
  COUNT(*) AS events,
  COUNT(DISTINCT installation_uuid) AS users,
  ANY_VALUE(issue_title) AS title,
  SUBSTR(ANY_VALUE(issue_subtitle), 1, 110) AS subtitle,
  ANY_VALUE(CONCAT(IFNULL(frame.file, '?'), ':', IFNULL(CAST(frame.line AS STRING), '?'))) AS file_line,
  STRING_AGG(DISTINCT operating_system.display_version ORDER BY operating_system.display_version) AS os_versions,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', MAX(event_timestamp), 'Asia/Kolkata') AS last_seen_ist,
  issue_id
FROM base
GROUP BY ver, type, issue_id
ORDER BY events DESC
LIMIT $Limit
"@
}

$sqlFile = Join-Path ([System.IO.Path]::GetTempPath()) "fetch_crash_query.sql"
[System.IO.File]::WriteAllText($sqlFile, $sql, (New-Object System.Text.UTF8Encoding($false)))

# Use the folder-local gcloud login for this run only, then restore.
$prevConfig = $env:CLOUDSDK_CONFIG
$localConfig = Join-Path $PSScriptRoot ".gcloud"
if (Test-Path $localConfig) { $env:CLOUDSDK_CONFIG = $localConfig }

try {
	$verLabel = if ($Version) { $Version } else { "latest" }
	Write-Host "Crashlytics | version: $verLabel | last $Days day(s) | type: $Type | SQL: $sqlFile" -ForegroundColor Cyan
	# Feed the SQL file to bq via cmd.exe redirection: piping from PowerShell 5.1
	# prepends a UTF-8 BOM, which bq rejects ("Illegal input character \357").
	cmd /c "bq query --project_id=$Project --use_legacy_sql=false --format=pretty --max_rows=$Limit < `"$sqlFile`""
	if ($LASTEXITCODE -ne 0) {
		Write-Host "bq query failed. If it is a permission error, log in with an account that can read $Project (see header of this script)." -ForegroundColor Red
		exit $LASTEXITCODE
	}
} finally {
	$env:CLOUDSDK_CONFIG = $prevConfig
}
