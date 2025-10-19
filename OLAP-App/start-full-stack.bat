@echo off
echo 🚀 Starting Full Stack Credit Card OLAP Dashboard...
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

REM Start the API server in a new window
start "Real DB API Server" /min cmd /c "node real-db-server.js & pause"

REM Wait for the server to start
echo ⏳ Waiting for API server to start...
timeout /t 5 /nobreak >nul

REM Check if API server is running
echo 🔍 Checking if API server is running...
netstat -an | findstr ":4000" >nul
if %errorlevel% neq 0 (
    echo ❌ API server failed to start
    pause
    exit /b 1
) else (
    echo ✅ API server is running on port 4000
)

echo.
echo ✅ Starting React Dashboard...
echo.
echo 📊 Dashboard will be available at: http://localhost:5173
echo 🔗 API server: http://localhost:4000
echo.
echo Press Ctrl+C to stop the dashboard
echo.

REM Start the React app
npm run dev
