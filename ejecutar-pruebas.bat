@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Suite E2E SauceDemo - Playwright
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta PC.
  echo Instalalo desde https://nodejs.org ^(version LTS^) y volve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] Instalando dependencias... ^(solo la primera vez^)
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/3] Dependencias ya instaladas.
)
echo.

echo [2/3] Instalando el navegador Chromium... ^(solo la primera vez^)
call npx playwright install chromium
if errorlevel 1 goto :error
echo.

echo [3/3] Ejecutando los 41 tests y generando el reporte...
call npm run test:report
set TEST_EXIT=%errorlevel%
echo.

if exist "test-results\\dashboard.html" (
  echo Abriendo el dashboard en el navegador...
  start "" "test-results\\dashboard.html"
)

echo.
echo ============================================================
if "%TEST_EXIT%"=="0" (
  echo   Resultado: TODOS LOS TESTS PASARON
) else (
  echo   Resultado: HUBO TESTS QUE FALLARON
  echo   Para ver el detalle con trace y video, ejecuta: npm run report
)
echo ============================================================
echo.
pause
exit /b %TEST_EXIT%

:error
echo.
echo [ERROR] Fallo un paso de la preparacion. Revisa el mensaje de arriba.
pause
exit /b 1
