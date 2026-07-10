<#
.SYNOPSIS
  Manual ticker entry mode - type a headline, set how long it stays live,
  and it goes on the wire immediately.

.DESCRIPTION
  Writes a structured ticker entry (spec 6.5) into the newsroom-wide desk
  folder <ArchiveRoot>\ticker\ (for announcements not tied to one event
  folder), then runs the normal compile + commit + push so the entry goes
  live right away. Because the compile is a full archive rebuild, any other
  publishable archive entries ride along in the same push.

  The entry self-expires: "days on the wire" sets the expires date, and the
  compiler drops it automatically after that - no cleanup needed. The yaml
  file stays in the desk folder as a record.

  Run with no arguments for interactive prompts (what update-ticker.bat
  option 2 does), or pass parameters for non-interactive use:

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File add-ticker-entry.ps1 -Headline "Community market returns to East End this Sunday" -Days 5

.EXAMPLE
  # write the entry but do not compile/push (staging)
  powershell -ExecutionPolicy Bypass -File add-ticker-entry.ps1 -Headline "..." -Days 3 -NoPush
#>
param(
  [string]$Headline = '',
  [int]$Days = 0,
  [string]$Link = '',
  [int]$Priority = 90,
  [string]$Category = '',
  [string]$ArchiveRoot = 'F:\Media',
  [switch]$NoPush
)

$interactive = (-not $Headline)

if ($interactive) {
  Write-Output ''
  Write-Output 'MANUAL TICKER ENTRY - written for the public, not for contributors.'
  Write-Output 'One complete, verifiable development in 8-15 words. No unconfirmed names.'
  Write-Output ''
  $Headline = Read-Host 'Headline'
}
$Headline = $Headline.Trim()
if (-not $Headline) {
  Write-Error 'No headline entered - nothing created.'
  exit 1
}

if ($Days -le 0) {
  $d = Read-Host 'Days on the wire (Enter = 7)'
  if ($d -match '^\d+$' -and [int]$d -gt 0) { $Days = [int]$d } else { $Days = 7 }
}

if ($interactive) {
  $Link     = (Read-Host 'Link URL (Enter for none)').Trim()
  $Category = (Read-Host 'Category / beat (Enter for none)').Trim()
}

$today   = Get-Date
$expires = $today.AddDays($Days - 1).ToString('yyyy-MM-dd')   # Days=1 -> today only

$deskDir = Join-Path $ArchiveRoot 'ticker'
if (-not (Test-Path $deskDir)) { New-Item -ItemType Directory -Path $deskDir | Out-Null }

$file = Join-Path $deskDir ($today.ToString('yyyyMMdd_HHmmss') + '.yaml')

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('# manual entry - created by add-ticker-entry.ps1 on ' + $today.ToString('yyyy-MM-dd HH:mm'))
$lines.Add('headline: ' + $Headline)
$lines.Add('status: active')
$lines.Add('priority: ' + $Priority)
$lines.Add('updated: ' + $today.ToString('yyyy-MM-dd'))
$lines.Add('expires: ' + $expires)
if ($Category) { $lines.Add('category: ' + $Category) }
if ($Link)     { $lines.Add('link: ' + $Link) }

$lines | Out-File -FilePath $file -Encoding utf8

Write-Output ''
Write-Output "Entry written: $file"
Write-Output "On the wire today through $expires ($Days day$(if ($Days -ne 1) {'s'})), priority $Priority."

if ($NoPush) {
  Write-Output 'NoPush set - entry staged only. Run update-ticker.bat option 1 to publish.'
  exit 0
}

Write-Output ''
Write-Output 'Compiling and publishing the wire...'
& (Join-Path $PSScriptRoot 'compile-ticker.ps1') `
  -SourceDir $ArchiveRoot `
  -StateFile (Join-Path $PSScriptRoot 'ticker-scan-state.json') `
  -CommitPush
