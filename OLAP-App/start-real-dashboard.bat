@echo off
echo 🚀 Starting Credit Card OLAP Dashboard with Real Database...
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this from the OLAP-App directory.
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo ✅ Starting Real Database API Server...
echo.
echo 📊 API will be available at: http://localhost:4000
echo 🔗 Health check: http://localhost:4000/health
echo.

REM Start the real database server in the background
start "Real DB API Server" cmd /k "node real-db-server.js"

REM Wait a moment for the server to start
timeout /t 3 /nobreak >nul

echo ✅ Starting React Dashboard...
echo.
echo 📊 Dashboard will be available at: http://localhost:5173
echo.
echo Press Ctrl+C to stop the dashboard
echo.

REM Start the React app
call npm run dev
