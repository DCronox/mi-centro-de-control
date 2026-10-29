@echo off
setlocal
cd /d "%~dp0"
start "Mi Centro de Control" http://localhost:8765/index.html
node "%~dp0servidor-local.mjs"
echo.
echo El servidor local se detuvo. Puedes cerrar esta ventana.
pause
