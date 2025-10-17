@echo off
REM Credit Card OLAP Dashboard - Quick Start Script for Windows
REM This script sets up and starts the Cube.js + React dashboard

echo 🚀 Starting Credit Card OLAP Dashboard Setup...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

echo ✅ Node.js detected
node --version

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Check if MySQL is running (basic check)
echo 🔍 Checking MySQL connection...
timeout /t 2 /nobreak >nul

REM Create environment file if it doesn't exist
if not exist .env (
    echo 📝 Creating environment configuration...
    (
        echo # Cube.js Configuration
        echo CUBEJS_DB_HOST=127.0.0.1
        echo CUBEJS_DB_PORT=3306
        echo CUBEJS_DB_NAME=gosales_dw
        echo CUBEJS_DB_USER=dw
        echo CUBEJS_DB_PASS=DwPass!123
        echo CUBEJS_API_SECRET=your-secret-key-change-in-production
        echo CUBEJS_DEV_MODE=true
        echo CUBEJS_TELEMETRY=false
        echo.
        echo # Frontend Configuration
        echo VITE_CUBEJS_API_URL=http://localhost:4000/cubejs-api/v1
    ) > .env
    echo ✅ Environment file created
)

REM Start the application
echo 🎯 Starting the dashboard...
echo    This will start both the Cube.js server and React app
echo    Dashboard will be available at: http://localhost:5173
echo    Cube.js API at: http://localhost:4000
echo    Press Ctrl+C to stop
echo.

call npm run dev:full
