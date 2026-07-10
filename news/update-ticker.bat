@echo off
REM ============================================================
REM  Cadenza Arthouse Press - ticker desk
REM
REM  [1] Archive sweep: scans F:\Media for structured ticker
REM      entries (ticker\NNN.yaml per event - spec 6.5). Any
REM      draft/scheduled entries open in the APPROVAL DESK where
REM      you can approve all, or open each one and approve /
REM      publish / hide / archive it individually. Then filters
REM      by status/expiration, sorts by priority, rebuilds
REM      news\ticker.json, and pushes it live if it changed.
REM
REM  [2] Manual entry: type/paste one headline, set how many
REM      days it stays live, and it goes on the wire immediately
REM      (written to F:\Media\ticker\ so the archive stays the
REM      source of truth, then compiled + pushed like option 1).
REM
REM  [3] Schedule: headline + start + end (date or date+time).
REM      Push any time before the window - the site holds the
REM      item and shows it only between start and end, by each
REM      visitor's clock. No republish needed on the day.
REM
REM  [4] Queue manager: list every desk entry (F:\Media\ticker\),
REM      open one to edit any field or delete it.
REM
REM  Safe to run repeatedly - it only pushes when the wire
REM  actually changed. Scheduled/scripted runs can skip the menu:
REM      update-ticker.bat sweep
REM ============================================================
setlocal

REM non-interactive shortcut for Task Scheduler / scripts
if /i "%~1"=="sweep" goto sweep

echo.
echo  CADENZA ARTHOUSE PRESS - ticker desk
echo  --------------------------------------
echo.
echo    [1] Push latest ticker archive updates  (scan F:\Media)
echo    [2] Write a single ticker entry myself  (manual mode)
echo    [3] Schedule a ticker entry             (start + end time)
echo    [4] Edit or delete queued entries       (desk queue)
echo    [Q] Quit
echo.
choice /c 1234Q /n /m "  Choose: "
if errorlevel 5 goto :eof
if errorlevel 4 goto managequeue
if errorlevel 3 goto schedule
if errorlevel 2 goto manual

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compile-ticker.ps1" ^
  -SourceDir "F:\Media" ^
  -StateFile "%~dp0ticker-scan-state.json" ^
  -Review ^
  -CommitPush
goto done

REM unattended sweep (Task Scheduler): same job, no prompts
:sweep
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compile-ticker.ps1" ^
  -SourceDir "F:\Media" ^
  -StateFile "%~dp0ticker-scan-state.json" ^
  -CommitPush
goto done

:manual
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0add-ticker-entry.ps1"
goto done

:schedule
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-ticker.ps1" -Add
goto done

:managequeue
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-ticker.ps1" -Manage
goto done

:done
echo.
REM Pause only when double-clicked (so the window stays readable),
REM not when called from a terminal or another script.
echo %cmdcmdline% | find /i "%~f0" >nul && pause
