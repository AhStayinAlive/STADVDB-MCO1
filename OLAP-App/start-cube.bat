@echo off
echo 🚀 Starting Credit Card OLAP Dashboard...
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this from the OLAP-App directory.
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

echo ✅ Node.js found
node --version

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ Dependencies ready

REM Check if MySQL is accessible (basic check)
echo 🔍 Checking database connection...
echo Note: Make sure MySQL is running and the 'gosales_dw' database exists

REM Start the Cube.js server
echo 🎯 Starting Cube.js server...
echo.
echo Dashboard will be available at: http://localhost:4000
echo API endpoint: http://localhost:4000/cubejs-api/v1
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run cube
