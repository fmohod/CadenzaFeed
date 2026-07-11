<#
.SYNOPSIS
  Compiles the website news ticker (news/ticker.json) from structured YAML
  ticker entries in the archive. Spec: AI_PROJECT_INSTRUCTIONS.md section 6.5.

.DESCRIPTION
  Walks -SourceDir recursively and collects ticker entries:

    <event folder>\ticker\001.yaml     (numbered entries - a story can evolve)
    <event folder>\ticker.yaml         (single-entry shorthand)
    <archive root>\ticker\*.yaml       (newsroom desk - manual/archive-wide entries)

  Entry schema (flat YAML):

    headline: Houston Yogis returns with weekly wellness gathering
    status: active          # draft | scheduled | breaking | active | published | archived | hidden
    priority: 80            # 100 breaking - 80 featured - 40 standard - 10 minor
    updated: 2026-07-10     # defaults to the file's last-modified date
    expires:                # optional YYYY-MM-DD; entry is ignored after this date
    category: Wellness      # optional beat label
    link:                   # optional URL

  Editorial rules built in:
    - only status breaking / active / published reaches the wire
    - expired entries are dropped silently
    - sort: priority (desc) then updated (desc); top $MaxItems make the wire

  -Review adds the APPROVAL DESK: after the scan, entries with status draft or
  scheduled are listed (full headline shown inline). You can approve all, or
  open any entry to see every field and set its status individually (approve /
  publish / hide / archive). Status changes are written back to the archive
  yaml files, then compilation continues with the new statuses. Never pass
  -Review on scheduled/unattended runs - it prompts on the console.

  If -StateFile is given, the script keeps a scan log and reports NEW / UPDATED
  entry files since the previous run.

.EXAMPLE
  # what update-ticker.bat option 1 runs (interactive sweep with approval desk)
  powershell -ExecutionPolicy Bypass -File compile-ticker.ps1 -SourceDir "F:\Media" -StateFile ticker-scan-state.json -Review -CommitPush

.EXAMPLE
  # unattended sweep (Task Scheduler / scripts): no prompts
  powershell -ExecutionPolicy Bypass -File compile-ticker.ps1 -SourceDir "F:\Media" -StateFile ticker-scan-state.json -CommitPush
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir,

  [string]$OutFile = '',

  [string]$StateFile = '',

  [int]$MaxItems = 12,

  [switch]$Review,

  [switch]$CommitPush
)

if (-not $OutFile) { $OutFile = Join-Path $PSScriptRoot 'ticker.json' }

if (-not (Test-Path $SourceDir)) {
  Write-Error "Source folder not found: $SourceDir"
  exit 1
}

$INCLUDE_STATUSES = @('breaking', 'active', 'published')
$today = (Get-Date).ToString('yyyy-MM-dd')

# ── scan state (path -> last-modified stamp) ─────────────────
$prevState = @{}
if ($StateFile -and (Test-Path $StateFile)) {
  try {
    $raw = Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $raw.PSObject.Properties) { $prevState[$p.Name] = $p.Value }
  } catch {
    Write-Warning "Could not read state file - treating all ticker entries as new."
  }
}
$newState = [ordered]@{}
$newCount = 0
$updCount = 0

# ── scan: one recursive pass for *.yaml, keep ticker entries ─
Write-Output "Scanning $SourceDir for ticker entries..."
$files = @(Get-ChildItem -Path $SourceDir -Filter *.yaml -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Directory.Name -eq 'ticker' -or $_.BaseName -eq 'ticker' })

$records = New-Object System.Collections.Generic.List[object]
$invalid = 0

foreach ($f in $files) {

  if ($StateFile) {
    $stamp = $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss.fff')
    if (-not $prevState.ContainsKey($f.FullName)) {
      Write-Output "  NEW:     $($f.FullName)"
      $newCount++
    } elseif ($prevState[$f.FullName] -ne $stamp) {
      Write-Output "  UPDATED: $($f.FullName)"
      $updCount++
    }
    $newState[$f.FullName] = $stamp
  }

  # flat YAML parse: "key: value" lines; comments (#) and blanks ignored
  $fields = @{}
  foreach ($line in Get-Content $f.FullName -Encoding UTF8) {
    $l = $line.Trim()
    if (-not $l -or $l.StartsWith('#') -or $l -eq '---') { continue }
    if ($l -match '^([A-Za-z_]+)\s*:\s*(.*)$') {
      # capture both groups before any further regex test clobbers $Matches
      $k = $Matches[1].ToLower()
      $v = $Matches[2].Trim()
      # a value that is nothing but a comment means "empty"
      if ($v.StartsWith('#')) { $v = '' }
      # strip an inline comment unless the value is a URL or quoted
      elseif ($v -notmatch '^["'']' -and $v -notmatch '://') { $v = ($v -split '\s+#', 2)[0].Trim() }
      $fields[$k] = $v.Trim('"').Trim("'")
    }
  }

  if (-not $fields['headline']) {
    Write-Warning "Skipping (no headline): $($f.FullName)"
    $invalid++
    continue
  }

  $status = if ($fields['status']) { $fields['status'].ToLower() } else { 'draft' }

  $priority = 40
  if ($fields['priority'] -match '^\d+$') { $priority = [int]$fields['priority'] }

  $updated = $fields['updated']
  if ($updated -notmatch '^\d{4}-\d{2}-\d{2}') { $updated = $f.LastWriteTime.ToString('yyyy-MM-dd') }
  $updated = $updated.Substring(0, 10)

  $records.Add([pscustomobject]@{
    File     = $f.FullName
    Headline = $fields['headline']
    Status   = $status
    Priority = $priority
    Updated  = $updated
    Starts   = $fields['starts']
    Expires  = $fields['expires']
    Category = $fields['category']
    Link     = $fields['link']
  })
}

Write-Output "Scanned $($files.Count) ticker entr$(if ($files.Count -eq 1) {'y'} else {'ies'}): $newCount new, $updCount updated."

if ($StateFile) {
  $newState | ConvertTo-Json | Out-File -FilePath $StateFile -Encoding utf8
}

# ── approval desk ────────────────────────────────────────────
function Set-TickerStatus {
  param($Record, [string]$NewStatus)
  $lines = @(Get-Content $Record.File -Encoding UTF8)
  $found = $false
  $out = foreach ($ln in $lines) {
    if (-not $found -and $ln -match '^\s*status\s*:') { $found = $true; 'status: ' + $NewStatus }
    else { $ln }
  }
  if (-not $found) { $out = @($out) + ('status: ' + $NewStatus) }
  $out | Out-File -FilePath $Record.File -Encoding utf8
  $Record.Status = $NewStatus
}

function Show-Val { param($v) if ($v) { $v } else { '(none)' } }

# a scheduled entry WITH a start time is pre-approved (scheduling is the
# approval); scheduled without one still needs the desk, like a draft
function Test-Pending { param($r) ($r.Status -eq 'draft') -or ($r.Status -eq 'scheduled' -and -not $r.Starts) }

$pending = @($records | Where-Object { Test-Pending $_ })

if ($Review -and $pending.Count -gt 0) {
  $changed = 0
  while ($true) {
    $pending = @($records | Where-Object { Test-Pending $_ })
    Write-Output ''
    Write-Output '  -------------------------------------------------------------'
    Write-Output "  PENDING APPROVAL: $($pending.Count) entr$(if ($pending.Count -eq 1) {'y'} else {'ies'})"
    Write-Output '  -------------------------------------------------------------'
    if ($pending.Count -eq 0) { Write-Output '  (queue is clear)'; break }
    for ($i = 0; $i -lt $pending.Count; $i++) {
      $p = $pending[$i]
      $cat = if ($p.Category) { $p.Category } else { '-' }
      Write-Output ("  [{0}] {1,-9} {2}  {3,-12} {4}" -f ($i + 1), $p.Status, $p.Updated, $cat, $p.Headline)
    }
    Write-Output '  -------------------------------------------------------------'
    Write-Output '  [#] open entry    [A] approve ALL and continue    [Enter] continue without them'
    $choice = (Read-Host '  Choose').Trim()

    if (-not $choice) { break }

    if ($choice -match '^[Aa]$') {
      foreach ($p in $pending) { Set-TickerStatus -Record $p -NewStatus 'active'; $changed++ }
      Write-Output "  Approved $($pending.Count) entr$(if ($pending.Count -eq 1) {'y'} else {'ies'}) (status: active)."
      break
    }

    if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $pending.Count) {
      $p = $pending[[int]$choice - 1]
      Write-Output ''
      Write-Output "  File:     $($p.File)"
      Write-Output "  Headline: $($p.Headline)"
      Write-Output "  Status:   $($p.Status)"
      Write-Output "  Priority: $($p.Priority)"
      Write-Output "  Updated:  $($p.Updated)"
      Write-Output "  Starts:   $(Show-Val $p.Starts)"
      Write-Output "  Expires:  $(Show-Val $p.Expires)"
      Write-Output "  Category: $(Show-Val $p.Category)"
      Write-Output "  Link:     $(Show-Val $p.Link)"
      Write-Output ''
      Write-Output '  [A] approve (active)  [P] mark published  [H] hide  [R] archive  [Enter] back'
      $act = (Read-Host '  Action').Trim()
      switch -regex ($act) {
        '^[Aa]$' { Set-TickerStatus -Record $p -NewStatus 'active';    $changed++; Write-Output '  -> active' }
        '^[Pp]$' { Set-TickerStatus -Record $p -NewStatus 'published'; $changed++; Write-Output '  -> published' }
        '^[Hh]$' { Set-TickerStatus -Record $p -NewStatus 'hidden';    $changed++; Write-Output '  -> hidden' }
        '^[Rr]$' { Set-TickerStatus -Record $p -NewStatus 'archived';  $changed++; Write-Output '  -> archived' }
        default  { }
      }
      continue
    }

    Write-Output '  (unrecognized choice)'
  }
  if ($changed -gt 0) { Write-Output "  Review complete: $changed status change$(if ($changed -ne 1) {'s'}) written to the archive." }
} elseif ($pending.Count -gt 0) {
  Write-Output "Pending approval (not on the wire): $($pending.Count) draft/scheduled entr$(if ($pending.Count -eq 1) {'y'} else {'ies'}) - run update-ticker.bat option 1 to review."
}

# ── filter, sort, write ──────────────────────────────────────
$excluded = 0
$expired  = 0
$items    = New-Object System.Collections.Generic.List[object]

foreach ($r in $records) {
  # publishable: normal live statuses, plus scheduled entries with a start
  # time (the website shows those only inside their start/expire window)
  $isTimed = ($r.Status -eq 'scheduled' -and $r.Starts)
  if (-not $isTimed -and $INCLUDE_STATUSES -notcontains $r.Status) { $excluded++; continue }
  if ($r.Expires -and $r.Expires.Substring(0, 10) -lt $today)      { $expired++;  continue }

  $entry = [ordered]@{
    date     = $r.Updated
    text     = $r.Headline
    priority = $r.Priority
    breaking = ($r.Status -eq 'breaking')
  }
  if ($r.Starts)   { $entry.starts   = $r.Starts }
  if ($r.Expires)  { $entry.expires  = $r.Expires }
  if ($r.Category) { $entry.category = $r.Category }
  if ($r.Link)     { $entry.link     = $r.Link }
  $entry.src = $r.File   # local sidecar only - stripped from the public file
  $items.Add([pscustomobject]$entry)
}

Write-Output "On the wire: $($items.Count) (excluded by status: $excluded, expired: $expired, invalid: $invalid)"

if ($items.Count -eq 0) {
  Write-Warning "No publishable ticker entries found - ticker.json left unchanged."
  exit 0
}

$selected = @($items | Sort-Object -Property @{Expression='priority'; Descending=$true}, @{Expression='date'; Descending=$true} | Select-Object -First $MaxItems)

# public wire: same items without the src paths
$public = @($selected | ForEach-Object {
  $o = [ordered]@{}
  foreach ($p in $_.PSObject.Properties) { if ($p.Name -ne 'src') { $o[$p.Name] = $p.Value } }
  [pscustomobject]$o
})

$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm')

$payload = [ordered]@{
  _readme    = 'Generated by compile-ticker.ps1 - edit the archive ticker entries (spec 6.5), not this file.'
  _generated = $stamp
  items      = $public
}
$payload | ConvertTo-Json -Depth 4 | Out-File -FilePath $OutFile -Encoding utf8

# local sidecar for the live ticker manager: items WITH their source paths
$sourcesFile = Join-Path (Split-Path $OutFile -Parent) 'ticker-sources.json'
$sidecar = [ordered]@{
  _readme    = 'Local map of live wire items to their archive source files. Not published (gitignored).'
  _generated = $stamp
  items      = $selected
}
$sidecar | ConvertTo-Json -Depth 4 | Out-File -FilePath $sourcesFile -Encoding utf8

Write-Output "Wrote $($selected.Count) ticker item(s) to $OutFile"

if ($CommitPush) {
  $repo = Split-Path $PSScriptRoot -Parent
  git -C $repo add $OutFile
  $status = git -C $repo status --porcelain -- $OutFile
  if ($status) {
    git -C $repo commit -m "ticker: auto-update $((Get-Date).ToString('yyyy-MM-dd HH:mm'))"
    git -C $repo push
    Write-Output 'Committed and pushed ticker.json - live in ~1 minute (GitHub Pages).'
  } else {
    Write-Output 'Ticker content unchanged - nothing to commit.'
  }
}
