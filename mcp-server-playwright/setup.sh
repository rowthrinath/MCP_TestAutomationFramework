#!/bin/bash

# MCP Playwright Server Setup Script

echo "🎭 Setting up MCP Playwright Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Build the project
echo ""
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Install Playwright browsers
echo ""
echo "🌐 Installing Playwright browsers..."
npx playwright install

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Failed to install Playwright browsers"
    echo "   You can install them later with: npx playwright install"
else
    echo "✅ Playwright browsers installed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Add the server to your MCP client configuration"
echo "   2. Use 'npm start' to run the server"
echo "   3. Check README.md for usage instructions"
echo ""
echo "Configuration example for Claude Desktop:"
echo '   {
     "mcpServers": {
       "playwright": {
         "command": "node",
         "args": ["'$(pwd)'/build/index.js"]
       }
     }
   }'
echo ""
