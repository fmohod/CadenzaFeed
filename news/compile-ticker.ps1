<#
.SYNOPSIS
  Compiles the website news ticker (news/ticker.json) from structured YAML
  ticker entries in the archive. Spec: AI_PROJECT_INSTRUCTIONS.md section 6.5.

.DESCRIPTION
  Walks -SourceDir recursively and collects ticker entries:

    <event folder>\ticker\001.yaml     (numbered entries - a story can evolve)
    <event folder>\ticker.yaml         (single-entry shorthand)

  Each entry is a flat YAML file:

    headline: Houston Yogis returns with weekly wellness gathering
    status: active          # draft | scheduled | breaking | active | published | archived | hidden
    priority: 80            # 100 breaking - 80 featured - 40 standard - 10 minor
    updated: 2026-07-10     # defaults to the file's last-modified date
    expires:                # optional YYYY-MM-DD; entry is ignored after this date
    category: Wellness      # optional beat label
    link:                   # optional URL

  The compiler has the editorial judgment built in:
    - only status breaking / active / published is shown; everything else stays archived
    - expired entries are silently dropped (no maintenance required)
    - sort: priority (desc), then updated (desc); top $MaxItems make the wire

  If -StateFile is given, the script keeps a scan log (file path -> modified stamp)
  and reports NEW / UPDATED entry files since the previous run. Informational only -
  the build is always a full idempotent rebuild; git decides whether to push.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File compile-ticker.ps1 -SourceDir "F:\Media" -StateFile ticker-scan-state.json -CommitPush

.NOTES
  The live site only updates when ticker.json is committed and pushed (GitHub
  Pages serves the repo, not your disk). Use -CommitPush for that.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir,

  [string]$OutFile = (Join-Path $PSScriptRoot 'ticker.json'),

  [string]$StateFile = '',

  [int]$MaxItems = 12,

  [switch]$CommitPush
)

if (-not (Test-Path $SourceDir)) {
  Write-Error "Source folder not found: $SourceDir"
  exit 1
}

$INCLUDE_STATUSES = @('breaking', 'active', 'published')
$today = (Get-Date).ToString('yyyy-MM-dd')

# previous scan state (path -> last-modified stamp)
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

# one recursive pass for *.yaml, then keep only ticker entries:
#   files inside a folder named "ticker", or files named "ticker.yaml"
$files = @(Get-ChildItem -Path $SourceDir -Filter *.yaml -File -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Directory.Name -eq 'ticker' -or $_.BaseName -eq 'ticker' })

$items    = New-Object System.Collections.Generic.List[object]
$excluded = 0
$expired  = 0
$invalid  = 0

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

  # flat YAML parse: "key: value" lines, comments (#) and blanks ignored
  $fields = @{}
  foreach ($line in Get-Content $f.FullName -Encoding UTF8) {
    $l = $line.Trim()
    if (-not $l -or $l.StartsWith('#') -or $l -eq '---') { continue }
    if ($l -match '^([A-Za-z_]+)\s*:\s*(.*)$') {
      # capture both groups before any further regex test clobbers $Matches
      $k = $Matches[1].ToLower()
      $v = $Matches[2].Trim()
      # strip an inline comment unless the value is a URL or quoted
      if ($v -notmatch '^["'']' -and $v -notmatch '://') { $v = ($v -split '\s+#', 2)[0].Trim() }
      $fields[$k] = $v.Trim('"').Trim("'")
    }
  }

  $headline = $fields['headline']
  if (-not $headline) {
    Write-Warning "Skipping (no headline): $($f.FullName)"
    $invalid++
    continue
  }

  $status = if ($fields['status']) { $fields['status'].ToLower() } else { 'draft' }
  if ($INCLUDE_STATUSES -notcontains $status) { $excluded++; continue }

  if ($fields['expires'] -and $fields['expires'] -lt $today) { $expired++; continue }

  $priority = 40
  if ($fields['priority'] -match '^\d+$') { $priority = [int]$fields['priority'] }

  $updated = $fields['updated']
  if ($updated -notmatch '^\d{4}-\d{2}-\d{2}') { $updated = $f.LastWriteTime.ToString('yyyy-MM-dd') }
  $updated = $updated.Substring(0, 10)   # tolerate full timestamps

  $entry = [ordered]@{
    date     = $updated
    text     = $headline
    priority = $priority
    breaking = ($status -eq 'breaking')
  }
  if ($fields['category']) { $entry.category = $fields['category'] }
  if ($fields['link'])     { $entry.link     = $fields['link'] }
  $items.Add([pscustomobject]$entry)
}

Write-Output "Scanned $($files.Count) ticker entr$(if ($files.Count -eq 1) {'y'} else {'ies'}): $newCount new, $updCount updated."
Write-Output "On the wire: $($items.Count) (excluded by status: $excluded, expired: $expired, invalid: $invalid)"

if ($StateFile) {
  $newState | ConvertTo-Json | Out-File -FilePath $StateFile -Encoding utf8
}

if ($items.Count -eq 0) {
  Write-Warning "No publishable ticker entries found - ticker.json left unchanged."
  exit 0
}

$selected = @($items | Sort-Object -Property @{Expression='priority'; Descending=$true}, @{Expression='date'; Descending=$true} | Select-Object -First $MaxItems)

$payload = [ordered]@{
  _readme    = 'Generated by compile-ticker.ps1 - edit the archive ticker entries (spec 6.5), not this file.'
  _generated = (Get-Date).ToString('yyyy-MM-dd HH:mm')
  items      = $selected
}

$payload | ConvertTo-Json -Depth 4 | Out-File -FilePath $OutFile -Encoding utf8
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
