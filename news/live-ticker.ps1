<#
.SYNOPSIS
  Live ticker manager - see what's on the website wire right now and
  change it: end times, indefinite runs, remove items, delete desk entries.

.DESCRIPTION
  Reads ticker.json (the published wire) plus the local sidecar
  ticker-sources.json (written by every compile) that maps each live item
  back to its archive source file. Item states shown:

    LIVE     on the site right now
    WAITING  scheduled, window has not opened yet
    ENDED    window closed since the last compile (will drop on next sweep)

  Actions write through to the ARCHIVE SOURCE FILES - never to ticker.json
  directly (the compiler regenerates that file, so direct edits would not
  survive). After changes you are offered a compile + push so the site
  updates immediately.

    [H] edit headline - retype it; the correction is written to the archive
        source yaml, so every future compile carries the fixed wording
    [E] change the end - new date/time, or "-" for INDEFINITE (never expires)
    [X] remove from site - sets the source entry status: hidden (the file
        stays in the archive as a record)
    [D] delete the file - offered only for newsroom desk entries
        (F:\Media\ticker\), where hand-made announcements live

  If the sidecar is missing or stale (archive reorganized), run the sweep
  (update-ticker.bat option 1) to regenerate it.
#>
param(
  [string]$TickerFile = '',
  [string]$SourcesFile = '',
  [string]$ArchiveRoot = 'F:\Media',
  [switch]$NoPush
)

if (-not $TickerFile)  { $TickerFile  = Join-Path $PSScriptRoot 'ticker.json' }
if (-not $SourcesFile) { $SourcesFile = Join-Path $PSScriptRoot 'ticker-sources.json' }
$deskDir = Join-Path $ArchiveRoot 'ticker'

function Parse-When {
  param([string]$s, [bool]$EndOfDay = $false)
  if (-not $s) { return $null }
  $s = $s.Trim()
  try {
    if ($s -match '^\d{4}-\d{2}-\d{2}$') {
      $d = [datetime]::ParseExact($s, 'yyyy-MM-dd', $null)
      if ($EndOfDay) { $d = $d.AddHours(23).AddMinutes(59).AddSeconds(59) }
      return $d
    }
    if ($s -match '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$') { return [datetime]::ParseExact($s, 'yyyy-MM-dd HH:mm', $null) }
  } catch { }
  return $null
}

function Get-LiveState {
  param($it)
  $now = Get-Date
  $s = Parse-When $it.starts
  $e = Parse-When $it.expires $true
  if ($s -and $s -gt $now) { return 'WAITING' }
  if ($e -and $e -lt $now) { return 'ENDED' }
  return 'LIVE'
}

# rewrite (or add/remove) one "key: value" line in a source yaml file
function Set-SourceField {
  param([string]$Path, [string]$Key, [string]$Value)
  $lines = @(Get-Content $Path -Encoding UTF8)
  $found = $false
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($ln in $lines) {
    if (-not $found -and $ln -match ('^\s*' + $Key + '\s*:')) {
      $found = $true
      $out.Add(($Key + ': ' + $Value).TrimEnd())
    } else {
      $out.Add($ln)
    }
  }
  if (-not $found) { $out.Add(($Key + ': ' + $Value).TrimEnd()) }
  $out | Out-File -FilePath $Path -Encoding utf8
}

function Show-Val { param($v) if ($v) { $v } else { '(none)' } }

if (-not (Test-Path $TickerFile)) {
  Write-Output "No published wire found ($TickerFile). Run update-ticker.bat option 1 first."
  exit 0
}
if (-not (Test-Path $SourcesFile)) {
  Write-Output 'No source map found - it is written by every sweep.'
  Write-Output 'Run update-ticker.bat option 1 once, then come back to this menu.'
  exit 0
}

$data = Get-Content $SourcesFile -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($data.items)
$dirty = $false

while ($true) {
  Write-Output ''
  Write-Output '  -------------------------------------------------------------'
  Write-Output "  ON THE WIRE (as of last compile: $($data._generated)) - $($items.Count) item$(if ($items.Count -ne 1) {'s'})"
  Write-Output '  -------------------------------------------------------------'
  if ($items.Count -eq 0) { Write-Output '  (wire is empty)'; break }
  for ($i = 0; $i -lt $items.Count; $i++) {
    $it = $items[$i]
    $state = Get-LiveState $it
    $win = if ($it.starts -or $it.expires) { "$(Show-Val $it.starts) -> $(if ($it.expires) { $it.expires } else { 'indefinite' })" } else { 'indefinite' }
    Write-Output ("  [{0}] {1,-8} p{2,-4} {3,-38} {4}" -f ($i + 1), $state, $it.priority, $win, $it.text)
  }
  Write-Output '  -------------------------------------------------------------'
  Write-Output '  [#] open item    [Enter] done'
  $choice = (Read-Host '  Choose').Trim()
  if (-not $choice) { break }
  if ($choice -notmatch '^\d+$' -or [int]$choice -lt 1 -or [int]$choice -gt $items.Count) {
    Write-Output '  (unrecognized choice)'
    continue
  }

  $it  = $items[[int]$choice - 1]
  $src = $it.src
  $srcOk   = ($src -and (Test-Path $src))
  $isDesk  = ($srcOk -and (Split-Path $src -Parent) -eq $deskDir)

  Write-Output ''
  Write-Output "  Headline: $($it.text)"
  Write-Output "  State:    $(Get-LiveState $it)"
  Write-Output "  Priority: $($it.priority)"
  Write-Output "  Starts:   $(Show-Val $it.starts)"
  Write-Output "  Ends:     $(if ($it.expires) { $it.expires } else { 'indefinite' })"
  Write-Output "  Source:   $(if ($srcOk) { $src } else { ($src + '  [MISSING - archive changed; run a sweep]') })"
  if (-not $srcOk) { continue }

  Write-Output ''
  $menu = '  [H] edit headline    [E] change end (or indefinite)    [X] remove from site'
  if ($isDesk) { $menu += '    [D] delete file' }
  Write-Output ($menu + '    [Enter] back')
  $act = (Read-Host '  Action').Trim()

  if ($act -match '^[Hh]$') {
    Write-Output "  Current:  $($it.text)"
    Write-Output '  Type the corrected headline (8-15 words, public-facing). Enter = cancel.'
    $v = (Read-Host '  New headline').Trim()
    if ($v) {
      Set-SourceField -Path $src -Key 'headline' -Value $v
      $it.text = $v
      Write-Output '  -> headline updated in the archive source'
      $dirty = $true
    } else {
      Write-Output '  Unchanged.'
    }
    continue
  }

  if ($act -match '^[Ee]$') {
    while ($true) {
      $v = (Read-Host '  New end (YYYY-MM-DD or "YYYY-MM-DD HH:mm", "-" = indefinite)').Trim()
      if ($v -eq '-') {
        Set-SourceField -Path $src -Key 'expires' -Value ''
        $it.expires = $null
        Write-Output '  -> runs indefinitely'
        $dirty = $true
        break
      }
      if ($v -and (Parse-When $v)) {
        Set-SourceField -Path $src -Key 'expires' -Value $v
        if ('expires' -in $it.PSObject.Properties.Name) { $it.expires = $v }
        else { $it | Add-Member -NotePropertyName expires -NotePropertyValue $v }
        Write-Output "  -> ends $v"
        $dirty = $true
        break
      }
      if (-not $v) { break }
      Write-Output '  Use YYYY-MM-DD, "YYYY-MM-DD HH:mm", or "-".'
    }
    continue
  }

  if ($act -match '^[Xx]$') {
    $sure = (Read-Host '  Remove this item from the site? (y/N)').Trim()
    if ($sure -match '^[Yy]$') {
      Set-SourceField -Path $src -Key 'status' -Value 'hidden'
      $items = @($items | Where-Object { $_ -ne $it })
      Write-Output '  -> hidden (source file kept in the archive)'
      $dirty = $true
    } else { Write-Output '  Kept.' }
    continue
  }

  if ($isDesk -and $act -match '^[Dd]$') {
    $sure = (Read-Host '  DELETE the desk entry file? (y/N)').Trim()
    if ($sure -match '^[Yy]$') {
      Remove-Item -Path $src -Force
      $items = @($items | Where-Object { $_ -ne $it })
      Write-Output '  -> deleted'
      $dirty = $true
    } else { Write-Output '  Kept.' }
    continue
  }
}

Write-Output ''
if (-not $dirty) { Write-Output 'No changes made.'; exit 0 }

Write-Output 'Changes were written to the archive source files.'
if ($NoPush) { Write-Output 'NoPush set - run update-ticker.bat option 1 (or sweep) to publish them.'; exit 0 }
$go = (Read-Host 'Compile and push the wire now so the site updates? (Y/n)').Trim()
if ($go -match '^[Nn]') { Write-Output 'Skipped - run update-ticker.bat to publish later.'; exit 0 }
& (Join-Path $PSScriptRoot 'compile-ticker.ps1') `
  -SourceDir $ArchiveRoot `
  -StateFile (Join-Path $PSScriptRoot 'ticker-scan-state.json') `
  -CommitPush
