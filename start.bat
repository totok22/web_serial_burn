@echo off
REM Windows one-click launcher for SerialFlash.
setlocal
cd /d "%~dp0"

set "HOST=127.0.0.1"
if defined SERIALFLASH_PORT (
    set "PORT=%SERIALFLASH_PORT%"
) else (
    set "PORT=8080"
)

set "PY="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if not errorlevel 1 (
    set "PY=py -3"
    goto :found_python
)

for %%C in (python python3) do (
    %%C -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
    if not errorlevel 1 (
        set "PY=%%C"
        goto :found_python
    )
)

echo Python 3.8+ not found. Please install it from:
echo https://www.python.org/downloads/
echo.
echo During installation on Windows, enable "Add python.exe to PATH".
pause
exit /b 1

:found_python
call :find_free_port
set "URL=http://%HOST%:%PORT%/index.html"

echo Starting SerialFlash
echo Project: %CD%
echo URL: %URL%
echo.
echo Keep this window open while using the web app.
echo Press Ctrl+C to stop the server.
echo.

start "" "%URL%"
%PY% -m http.server "%PORT%" --bind "%HOST%"
exit /b %ERRORLEVEL%

:find_free_port
netstat -ano -p tcp | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
    set /a PORT+=1
    goto :find_free_port
)
exit /b 0
