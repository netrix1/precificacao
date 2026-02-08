@echo off
setlocal enabledelayedexpansion

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo Iniciando servidor da Planilha de Precificacao...
where py >nul 2>nul
if %errorlevel%==0 (
  start "Servidor Precificacao" cmd /k "py server.py"
) else (
  start "Servidor Precificacao" cmd /k "python server.py"
)

echo Aguardando servidor ficar disponivel em %URL% ...
set /a retries=0
:wait_loop
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
if %errorlevel%==0 goto open_browser

set /a retries+=1
if !retries! geq 30 (
  echo Nao foi possivel confirmar o servidor em tempo habil.
  echo Abra manualmente: %URL%
  exit /b 1
)

timeout /t 1 /nobreak >nul
goto wait_loop

:open_browser
echo Servidor online. Abrindo pagina...
start "" "%URL%"

endlocal
