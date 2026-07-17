@echo off
title Rete 45 - generatore
cd /d "%~dp0"

REM Prima volta: installa le dipendenze del monorepo (serve Node.js installato).
if not exist "..\..\node_modules\vite\" (
  echo.
  echo Prima installazione delle dipendenze ^(solo la prima volta, un minuto^)...
  call npm install --prefix "..\.."
)

echo.
echo ============================================================
echo   Generatore Rete 45 - http://127.0.0.1:5273/
echo   Il browser si apre da solo tra qualche secondo.
echo   Per FERMARE l'app: chiudi questa finestra.
echo ============================================================
echo.

REM Avvia il server di sviluppo e apre il browser (--open).
call npm run dev -- --open
