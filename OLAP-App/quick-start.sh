#!/bin/bash

# Credit Card OLAP Dashboard - Quick Start Script
# This script sets up and starts the Cube.js + React dashboard

echo "🚀 Starting Credit Card OLAP Dashboard Setup..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if MySQL is running
echo "🔍 Checking MySQL connection..."
if ! nc -z 127.0.0.1 3306 2>/dev/null; then
    echo "⚠️  MySQL is not running on localhost:3306"
    echo "   Please start MySQL and ensure the 'gosales_dw' database exists"
    echo "   You can use the SQL scripts in the ../sql directory"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ MySQL connection successful"
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cat > .env << EOF
# Cube.js Configuration
CUBEJS_DB_HOST=127.0.0.1
CUBEJS_DB_PORT=3306
CUBEJS_DB_NAME=gosales_dw
CUBEJS_DB_USER=dw
CUBEJS_DB_PASS=DwPass!123
CUBEJS_API_SECRET=your-secret-key-change-in-production
CUBEJS_DEV_MODE=true
CUBEJS_TELEMETRY=false

# Frontend Configuration
VITE_CUBEJS_API_URL=http://localhost:4000/cubejs-api/v1
EOF
    echo "✅ Environment file created"
fi

# Start the application
echo "🎯 Starting the dashboard..."
echo "   This will start both the Cube.js server and React app"
echo "   Dashboard will be available at: http://localhost:5173"
echo "   Cube.js API at: http://localhost:4000"
echo "   Press Ctrl+C to stop"
echo ""

npm run dev:full
