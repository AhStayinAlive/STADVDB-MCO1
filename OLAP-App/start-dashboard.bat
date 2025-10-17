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

echo ✅ Starting React dashboard...
echo.
echo 📊 Dashboard will be available at: http://localhost:5173
echo.
echo Press Ctrl+C to stop the dashboard
echo.

REM Start the React app
call npm run dev
