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
echo.
echo   Su questo PC:           http://localhost:5270/  (si apre da solo)
echo   Da altri dispositivi:   guarda la riga "Network:" qui sotto
echo                           (stessa rete Wi-Fi/LAN, oggi ~192.168.1.116:5270)
echo.
echo   Per FERMARE: chiudi questa finestra.
echo ============================================================
echo.

call npm run suite
