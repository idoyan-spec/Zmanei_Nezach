@echo off
rem זמני נצח - משיכת נתוני השימוש ופתיחת הדשבורד.
rem הסודות מוזרקים מ-Bitwarden Secrets Manager.
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch.ps1" %*
if errorlevel 1 pause
