@echo off
REM ============================================================
REM  Cadenza Arthouse - ticker update on demand
REM
REM  Scans the archive (F:\Media) for structured ticker entries
REM  (ticker\NNN.yaml or ticker.yaml per event folder - spec 6.5),
REM  filters by status/expiration, sorts by priority, rebuilds
REM  news\ticker.json, and commits + pushes it to the live site if
REM  the ticker content changed.
REM
REM  Run it any time: double-click it, call it from a terminal, or
REM  point Task Scheduler at it. Safe to run repeatedly - it only
REM  pushes when something actually changed.
REM ============================================================

echo.
echo  CADENZA ARTHOUSE PRESS - ticker update
echo  ---------------------------------------
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compile-ticker.ps1" ^
  -SourceDir "F:\Media" ^
  -StateFile "%~dp0ticker-scan-state.json" ^
  -CommitPush

echo.
REM Pause only when double-clicked (so the window stays readable),
REM not when called from a terminal or another script.
echo %cmdcmdline% | find /i "%~f0" >nul && pause
