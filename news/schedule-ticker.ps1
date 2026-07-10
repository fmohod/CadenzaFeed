<#
.SYNOPSIS
  Scheduled ticker entries - add timed items to the wire (option 3) and
  edit/delete the desk queue (option 4).

.DESCRIPTION
  ADD mode (-Add): prompts for a headline, a start, and an end
  (YYYY-MM-DD or "YYYY-MM-DD HH:mm"), writes a status: scheduled entry with
  starts/expires into the newsroom desk folder <ArchiveRoot>\ticker\, and
  offers to compile + push. Once pushed, the website shows the item ONLY
  inside its window (checked against each visitor's clock), so it can be
  pushed days early and will appear and disappear right on time.

  MANAGE mode (-Manage): lists every entry in the desk folder with its
  status and window; open one to edit any field (Enter keeps the current
  value) or delete the file. Offers to compile + push when done.

  Both modes touch only the desk folder (instant - no archive scan).
  Event-folder entries are managed through the sweep's approval desk.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File schedule-ticker.ps1 -Add -Headline "Happy birthday to Mom" -Starts "2026-08-14" -Expires "2026-08-14" -NoPush
#>
param(
  [switch]$Add,
  [switch]$Manage,

  [string]$Headline = '',
  [string]$Starts = '',
  [string]$Expires = '',
  [int]$Priority = 70,
  [string]$Category = '',
  [string]$Link = '',

  [string]$ArchiveRoot = 'F:\Media',
  [switch]$NoPush
)

$deskDir = Join-Path $ArchiveRoot 'ticker'

function Parse-When {
  param([string]$s)
  $s = $s.Trim()
  try {
    if ($s -match '^\d{4}-\d{2}-\d{2}$')             { return [datetime]::ParseExact($s, 'yyyy-MM-dd', $null) }
    if ($s -match '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$') { return [datetime]::ParseExact($s, 'yyyy-MM-dd HH:mm', $null) }
  } catch { }
  return $null
}

function Read-When {
  param([string]$Prompt, [bool]$Required, [bool]$AllowClear = $false)
  while ($true) {
    $s = (Read-Host $Prompt).Trim()
    if (-not $s -and -not $Required) { return '' }
    if ($AllowClear -and $s -eq '-') { return '-' }
    if ($s -and (Parse-When $s)) { return $s }
    Write-Output '  Use YYYY-MM-DD or "YYYY-MM-DD HH:mm" (24h).'
  }
}

function Parse-Entry {
  param([string]$Path)
  $fields = @{}
  foreach ($line in Get-Content $Path -Encoding UTF8) {
    $l = $line.Trim()
    if (-not $l -or $l.StartsWith('#') -or $l -eq '---') { continue }
    if ($l -match '^([A-Za-z_]+)\s*:\s*(.*)$') {
      $k = $Matches[1].ToLower()
      $v = $Matches[2].Trim()
      if ($v -notmatch '^["'']' -and $v -notmatch '://') { $v = ($v -split '\s+#', 2)[0].Trim() }
      $fields[$k] = $v.Trim('"').Trim("'")
    }
  }
  return $fields
}

function Write-Entry {
  param([string]$Path, [hashtable]$F, [string]$Note)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('# ' + $Note)
  $lines.Add('headline: ' + $F['headline'])
  $lines.Add('status: '   + $F['status'])
  $lines.Add('priority: ' + $F['priority'])
  if ($F['updated'])  { $lines.Add('updated: '  + $F['updated']) }
  if ($F['starts'])   { $lines.Add('starts: '   + $F['starts']) }
  if ($F['expires'])  { $lines.Add('expires: '  + $F['expires']) }
  if ($F['category']) { $lines.Add('category: ' + $F['category']) }
  if ($F['link'])     { $lines.Add('link: '     + $F['link']) }
  $lines | Out-File -FilePath $Path -Encoding utf8
}

function Show-Val { param($v) if ($v) { $v } else { '(none)' } }

function Invoke-PushOffer {
  if ($script:NoPush) { Write-Output 'NoPush set - run update-ticker.bat option 1 (or sweep) to publish.'; return }
  $go = (Read-Host 'Compile and push the wire now? (Y/n)').Trim()
  if ($go -match '^[Nn]') { Write-Output 'Skipped - run update-ticker.bat to publish later.'; return }
  & (Join-Path $PSScriptRoot 'compile-ticker.ps1') `
    -SourceDir $ArchiveRoot `
    -StateFile (Join-Path $PSScriptRoot 'ticker-scan-state.json') `
    -CommitPush
}

# ═════════════════════════════ ADD ═════════════════════════════
if ($Add) {
  $interactive = (-not $Headline)

  if ($interactive) {
    Write-Output ''
    Write-Output 'SCHEDULE A TICKER ENTRY - it will display only inside its window.'
    Write-Output 'Public-facing text: one complete development in 8-15 words.'
    Write-Output ''
    $Headline = (Read-Host 'Headline').Trim()
    if (-not $Headline) { Write-Error 'No headline entered - nothing created.'; exit 1 }
    $Starts  = Read-When 'Start  (YYYY-MM-DD or YYYY-MM-DD HH:mm)' $true
    $Expires = Read-When 'End    (YYYY-MM-DD or YYYY-MM-DD HH:mm)' $true
    $Category = (Read-Host 'Category / beat (Enter for none)').Trim()
    $Link     = (Read-Host 'Link URL (Enter for none)').Trim()
  } else {
    if (-not (Parse-When $Starts))  { Write-Error 'Invalid -Starts (YYYY-MM-DD or "YYYY-MM-DD HH:mm").';  exit 1 }
    if (-not (Parse-When $Expires)) { Write-Error 'Invalid -Expires (YYYY-MM-DD or "YYYY-MM-DD HH:mm").'; exit 1 }
  }

  $startDt = Parse-When $Starts
  $endDt   = Parse-When $Expires
  if ($Expires -notmatch '\d{2}:\d{2}') { $endDt = $endDt.AddHours(23).AddMinutes(59) }  # date-only end = through that day
  if ($endDt -lt $startDt) { Write-Error "End ($Expires) is before start ($Starts) - nothing created."; exit 1 }

  if (-not (Test-Path $deskDir)) { New-Item -ItemType Directory -Path $deskDir | Out-Null }
  $now  = Get-Date
  $file = Join-Path $deskDir ($now.ToString('yyyyMMdd_HHmmss') + '.yaml')

  Write-Entry -Path $file -F @{
    headline = $Headline
    status   = 'scheduled'
    priority = $Priority
    updated  = $now.ToString('yyyy-MM-dd')
    starts   = $Starts
    expires  = $Expires
    category = $Category
    link     = $Link
  } -Note ('scheduled entry - created ' + $now.ToString('yyyy-MM-dd HH:mm'))

  Write-Output ''
  Write-Output "Entry written: $file"
  Write-Output "On the wire from $Starts through $Expires (visitor's clock), priority $Priority."
  Write-Output 'Push any time before the window - the site holds it until the start.'
  Write-Output ''
  Invoke-PushOffer
  exit 0
}

# ═══════════════════════════ MANAGE ═══════════════════════════
if ($Manage) {
  if (-not (Test-Path $deskDir)) {
    Write-Output "Desk folder is empty ($deskDir) - nothing to manage."
    exit 0
  }
  $dirty = $false
  while ($true) {
    $entries = @(Get-ChildItem -Path $deskDir -Filter *.yaml -File | Sort-Object Name)
    Write-Output ''
    Write-Output '  -------------------------------------------------------------'
    Write-Output "  DESK QUEUE ($deskDir): $($entries.Count) entr$(if ($entries.Count -eq 1) {'y'} else {'ies'})"
    Write-Output '  -------------------------------------------------------------'
    if ($entries.Count -eq 0) { Write-Output '  (empty)'; break }
    $parsed = @()
    for ($i = 0; $i -lt $entries.Count; $i++) {
      $f = Parse-Entry $entries[$i].FullName
      $parsed += ,@($entries[$i].FullName, $f)
      $win = if ($f['starts'] -or $f['expires']) { "$(Show-Val $f['starts']) -> $(Show-Val $f['expires'])" } else { 'no window' }
      Write-Output ("  [{0}] {1,-10} {2,-36} {3}" -f ($i + 1), $f['status'], $win, $f['headline'])
    }
    Write-Output '  -------------------------------------------------------------'
    Write-Output '  [#] open entry    [Enter] done'
    $choice = (Read-Host '  Choose').Trim()
    if (-not $choice) { break }
    if ($choice -notmatch '^\d+$' -or [int]$choice -lt 1 -or [int]$choice -gt $entries.Count) {
      Write-Output '  (unrecognized choice)'
      continue
    }

    $path = $parsed[[int]$choice - 1][0]
    $f    = $parsed[[int]$choice - 1][1]
    Write-Output ''
    Write-Output "  File:     $path"
    Write-Output "  Headline: $($f['headline'])"
    Write-Output "  Status:   $(Show-Val $f['status'])"
    Write-Output "  Priority: $(Show-Val $f['priority'])"
    Write-Output "  Starts:   $(Show-Val $f['starts'])"
    Write-Output "  Expires:  $(Show-Val $f['expires'])"
    Write-Output "  Category: $(Show-Val $f['category'])"
    Write-Output "  Link:     $(Show-Val $f['link'])"
    Write-Output ''
    Write-Output '  [E] edit    [D] delete    [Enter] back'
    $act = (Read-Host '  Action').Trim()

    if ($act -match '^[Dd]$') {
      $sure = (Read-Host "  Delete this entry? (y/N)").Trim()
      if ($sure -match '^[Yy]$') {
        Remove-Item -Path $path -Force
        Write-Output '  Deleted.'
        $dirty = $true
      } else {
        Write-Output '  Kept.'
      }
      continue
    }

    if ($act -match '^[Ee]$') {
      Write-Output '  Enter a new value, or press Enter to keep the current one.'
      $v = (Read-Host "  Headline [$($f['headline'])]").Trim();                    if ($v) { $f['headline'] = $v }
      $v = (Read-Host "  Status   [$(Show-Val $f['status'])]").Trim();             if ($v) { $f['status'] = $v.ToLower() }
      $v = (Read-Host "  Priority [$(Show-Val $f['priority'])]").Trim();           if ($v -match '^\d+$') { $f['priority'] = $v }
      $v = Read-When "  Starts   [$(Show-Val $f['starts'])] (- to clear)" $false $true
      if ($v -eq '-') { $f['starts'] = '' } elseif ($v) { $f['starts'] = $v }
      $v = Read-When "  Expires  [$(Show-Val $f['expires'])] (- to clear)" $false $true
      if ($v -eq '-') { $f['expires'] = '' } elseif ($v) { $f['expires'] = $v }
      $v = (Read-Host "  Category [$(Show-Val $f['category'])]").Trim();           if ($v) { $f['category'] = $v }
      $v = (Read-Host "  Link     [$(Show-Val $f['link'])]").Trim();               if ($v) { $f['link'] = $v }
      if (-not $f['priority']) { $f['priority'] = 70 }
      if (-not $f['status'])   { $f['status'] = 'scheduled' }
      Write-Entry -Path $path -F $f -Note ('edited ' + (Get-Date).ToString('yyyy-MM-dd HH:mm'))
      Write-Output '  Saved.'
      $dirty = $true
      continue
    }
  }

  Write-Output ''
  if ($dirty) { Invoke-PushOffer } else { Write-Output 'No changes made.' }
  exit 0
}

Write-Output 'Pass -Add (schedule an entry) or -Manage (edit/delete the desk queue).'
