@echo off
rem ---------------------------------------------------------------------------
rem  זמני נצח — משיכת נתוני השימוש ופתיחת הדשבורד.
rem  ההגדרות האישיות יושבות ב-settings.local.cmd, שאיננו נכנס ל-git.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if exist "settings.local.cmd" (
  call "settings.local.cmd"
) else (
  echo.
  echo   עדיין לא הוגדר אוסף נתונים.
  echo   פתחו את collector\README.md ובצעו את ההקמה החד-פעמית.
  echo.
  start "" "..\collector\README.md"
  pause
  exit /b 1
)

node refresh.mjs
if errorlevel 1 pause
