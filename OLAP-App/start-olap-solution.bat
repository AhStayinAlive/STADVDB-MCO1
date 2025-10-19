@echo off
echo 🚀 Starting Complete OLAP Solution...
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this from the OLAP-App directory.
    echo Current directory: %CD%
    pause
    exit /b 1
)

echo ✅ Starting Enhanced OLAP API Server...
echo.

REM Start the OLAP server in a new window
start "OLAP API Server" /min cmd /c "node olap-enhanced-server.js & pause"

REM Wait for the server to start
echo ⏳ Waiting for OLAP API server to start...
timeout /t 5 /nobreak >nul

REM Check if API server is running
echo 🔍 Checking if OLAP API server is running...
netstat -an | findstr ":4000" >nul
if %errorlevel% neq 0 (
    echo ❌ OLAP API server failed to start
    pause
    exit /b 1
) else (
    echo ✅ OLAP API server is running on port 4000
)

echo.
echo ✅ Starting React OLAP Dashboard...
echo.
echo 🎯 OLAP Solution Access Points:
echo    📊 Dashboard: http://localhost:5173
echo    🔗 OLAP API: http://localhost:4000
echo    📈 Health Check: http://localhost:4000/health
echo    🔍 Meta Info: http://localhost:4000/cubejs-api/v1/meta
echo.
echo 🚀 OLAP Features Available:
echo    ✅ Multi-dimensional Analysis (Slicing)
echo    ✅ Drill-down Capabilities (Drilling)
echo    ✅ Dynamic Filtering (Dicing)
echo    ✅ Real-time Pivoting (Pivoting)
echo    ✅ Time Intelligence
echo    ✅ Calculated Measures
echo    ✅ Interactive Query Builder
echo.
echo Press Ctrl+C to stop the dashboard
echo.

REM Start the React app
npm run dev
