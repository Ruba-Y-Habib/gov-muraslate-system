@echo off
setlocal
chcp 65001 >nul
title Murasalat - Latakia Finance Directorate

cd /d "%~dp0"

echo ================================================
echo   MURASALAT - Internal Correspondence System
echo   Latakia Finance Directorate
echo ================================================
echo.
echo Current folder: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed on this computer.
    echo         Download and install it from https://nodejs.org
    echo         then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist "server\.env" (
    if exist "server\.env.example" (
        copy "server\.env.example" "server\.env" >nul
        echo [INFO] A settings file was created: server\.env
        echo        IMPORTANT: open it and put your SQL Server sa password
        echo        in DB_PASSWORD, save, then run this file again.
        echo        Arabic guide: README.md
        echo.
        pause
        exit /b 0
    )
)

if not exist "server\.env" (
    echo [ERROR] server\.env not found.
    echo         Copy server\.env.example to server\.env and edit it.
    echo         See README.md section 2.
    echo.
    pause
    exit /b 1
)

if not exist "server\uploads" mkdir "server\uploads"

if not exist "server\node_modules" (
    echo [STEP 1/3] Installing server dependencies... first run only, please wait.
    cd server
    call npm install
    if errorlevel 1 goto :failed
    cd ..
)

if not exist "client\node_modules" (
    echo [STEP 2/3] Installing interface dependencies... first run only, please wait.
    cd client
    call npm install
    if errorlevel 1 goto :failed
    cd ..
)

if not exist "client\dist\index.html" (
    echo [STEP 3/3] Building the interface... first run only, please wait.
    cd client
    call npm run build
    if errorlevel 1 goto :failed
    cd ..
)

echo [DB SETUP] Preparing the database... first run creates it automatically.
cd server
call npm run setup
if errorlevel 1 goto :failed
cd ..

echo.
echo ================================================================
echo  Starting the system on:  http://localhost:3001
echo  From other computers:    http://SERVER-IP:3001
echo  Close this window to stop the system.
echo ================================================================
echo.

cd server
node src/index.js

echo.
echo The server stopped. Read the error message above.
echo Most common cause: database settings in server\.env
echo Arabic guide: README.md
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] A step failed. Read the error message above.
echo Arabic guide: README.md
echo.
pause
exit /b 1
