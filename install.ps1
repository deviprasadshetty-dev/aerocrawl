# AeroCrawl Install Script for Windows (PowerShell)
# Usage: .\install.ps1
# For Agents: This script can be auto-downloaded and executed

$ErrorActionPreference = "Stop"

Write-Host "=== AeroCrawl Installer for Windows ===" -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Node.js not found" }
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "ERROR: Node.js ≥ 18 required. Found: $nodeVersion" -ForegroundColor Red
        Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found. Please install Node.js ≥ 18" -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Git
try {
    $gitVersion = git --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Git not found" }
    Write-Host "✓ $gitVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git not found. Please install Git" -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# Check Chrome/Edge
$chromePath = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$edgePath = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (!(Test-Path $chromePath) -and !(Test-Path $edgePath)) {
    Write-Host "WARNING: Chrome or Edge not found. CDP requires one of them." -ForegroundColor Yellow
}

# Clone and install
if (Test-Path "aerocrawl") {
    Write-Host "AeroCrawl directory already exists. Pulling latest..." -ForegroundColor Yellow
    Set-Location aerocrawl
    git pull
} else {
    Write-Host "Cloning AeroCrawl..." -ForegroundColor Cyan
    git clone https://github.com/deviprasadshetty-dev/aerocrawl.git
    Set-Location aerocrawl
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Building..." -ForegroundColor Cyan
npm run build

Write-Host "Linking globally..." -ForegroundColor Cyan
npm link

# Verify
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Cyan
try {
    $help = aerocrawl --help 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ AeroCrawl installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Usage: aerocrawl https://example.com" -ForegroundColor White
        Write-Host "MCP Server: aerocrawl -m mcp" -ForegroundColor White
    }
} catch {
    Write-Host "WARNING: Installation completed but 'aerocrawl' command not found in PATH" -ForegroundColor Yellow
    Write-Host "Try restarting PowerShell or run: npm link" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Optional: Configure LLM for extract/agent modes:" -ForegroundColor Cyan
Write-Host "  Create .env file with: LLM_PROVIDER=openrouter" -ForegroundColor White
Write-Host "  Get free API key: https://openrouter.ai" -ForegroundColor White
