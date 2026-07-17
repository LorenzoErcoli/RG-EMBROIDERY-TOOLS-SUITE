@echo off
title RG Tools
cd /d "%~dp0"

REM Prima volta: installa le dipendenze del monorepo (serve Node.js installato).
if not exist "node_modules\vite\" (
  echo.
  echo Prima installazione delle dipendenze ^(solo la prima volta^)...
  call npm install
)

echo.
echo ============================================================
echo   RG Tools - suite strumenti ricamo
echo   http://127.0.0.1:5270/  (il browser si apre da solo)
echo   Per FERMARE: chiudi questa finestra.
echo ============================================================
echo.

call npm run suite
