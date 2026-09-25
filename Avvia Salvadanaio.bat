@echo off
REM Doppio clic su questo file per avviare il Salvadanaio su Windows.

cd /d "%~dp0"
cls

REM Cerco Node: prima quello eventualmente messo nella cartella node-win,
REM poi quello installato nel computer.
set "NODE="
if exist "node-win\node.exe" set "NODE=node-win\node.exe"
if not defined NODE (
  for /f "delims=" %%i in ('where node 2^>nul') do set "NODE=%%i"
)

if not defined NODE (
  echo.
  echo   Manca Node.js, che e' il motore su cui gira il Salvadanaio.
  echo.
  echo   Come rimediare:
  echo     1. Vai su   https://nodejs.org
  echo     2. Scarica la versione LTS per Windows
  echo     3. Installala facendo doppio clic sul file scaricato
  echo     4. Torna qui e fai di nuovo doppio clic su "Avvia Salvadanaio"
  echo.
  echo   Se il computer non ti lascia installare programmi, scarica da
  echo   nodejs.org il pacchetto .zip per Windows, estrailo e rinomina la
  echo   cartella ottenuta in  node-win  mettendola qui dentro.
  echo.
  pause
  exit /b 1
)

REM Il browser lo apre il programma stesso, appena e' pronto.
"%NODE%" server.js

echo.
echo   Il Salvadanaio e' stato chiuso.
pause
