#!/bin/bash
# AeroCrawl Install Script for Mac/Linux
# Usage: bash install.sh
# For Agents: This script can be auto-downloaded and executed

set -e

echo "=== AeroCrawl Installer for Mac/Linux ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Please install Node.js ≥ 18"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js ≥ 18 required. Found: $NODE_VERSION"
    echo "Download from: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js $NODE_VERSION found"

# Check Git
if ! command -v git &> /dev/null; then
    echo "ERROR: Git not found. Please install Git"
    echo "Download from: https://git-scm.com/"
    exit 1
fi
echo "✓ $(git --version) found"

# Check Chrome/Edge
if ! command -v google-chrome &> /dev/null && ! command -v chromium &> /dev/null && ! command -v microsoft-edge &> /dev/null; then
    echo "WARNING: Chrome, Chromium, or Edge not found. CDP requires one of them."
fi

# Clone and install
if [ -d "aerocrawl" ]; then
    echo "AeroCrawl directory already exists. Pulling latest..."
    cd aerocrawl
    git pull
else
    echo "Cloning AeroCrawl..."
    git clone https://github.com/deviprasadshetty-dev/aerocrawl.git
    cd aerocrawl
fi

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Linking globally..."
npm link

# Verify
echo ""
echo "Verifying installation..."
if command -v aerocrawl &> /dev/null; then
    echo "✓ AeroCrawl installed successfully!"
    echo ""
    echo "Usage: aerocrawl https://example.com"
    echo "MCP Server: aerocrawl -m mcp"
else
    echo "WARNING: Installation completed but 'aerocrawl' command not found in PATH"
    echo "Try restarting terminal or run: npm link"
fi

echo ""
echo "Optional: Configure LLM for extract/agent modes:"
echo "  Create .env file with: LLM_PROVIDER=openrouter"
echo "  Get free API key: https://openrouter.ai"
