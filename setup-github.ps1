# aDOs IDE - GitHub Repository Setup Script
# This script helps you push the project to GitHub

Write-Host "=== aDOs IDE GitHub Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if GitHub CLI is available
$ghAvailable = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghAvailable) {
    Write-Host "GitHub CLI (gh) is not installed." -ForegroundColor Yellow
    Write-Host "Install it from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatively, you can manually:" -ForegroundColor Yellow
    Write-Host "1. Create a repository on GitHub.com named 'ados-ide'" -ForegroundColor Yellow
    Write-Host "2. Run: git remote add origin https://github.com/Jakedoes1111/ados-ide.git" -ForegroundColor Yellow
    Write-Host "3. Run: git push -u origin main" -ForegroundColor Yellow
    exit 1
}

# Check if authenticated
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub CLI is not authenticated." -ForegroundColor Yellow
    Write-Host "Please run: gh auth login" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "GitHub CLI is authenticated. Proceeding..." -ForegroundColor Green
Write-Host ""

# Repository name
$repoName = "ados-ide"
$repoDescription = "A local, AI-augmented IDE and mini-OS for cognitive development. Combines IDE, AI agents, visual flows, embedded browser, knowledge management, and infinite canvas - all running locally."

# Check if remote already exists
$existingRemote = git remote get-url origin 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to update it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Keeping existing remote." -ForegroundColor Yellow
        Write-Host "To push: git push -u origin main" -ForegroundColor Cyan
        exit 0
    }
    git remote remove origin
}

Write-Host "Creating GitHub repository: $repoName" -ForegroundColor Cyan
Write-Host "Description: $repoDescription" -ForegroundColor Gray
Write-Host ""

# Create repository and push
try {
    gh repo create $repoName `
        --public `
        --source=. `
        --remote=origin `
        --description="$repoDescription" `
        --push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Successfully created and pushed to GitHub!" -ForegroundColor Green
        Write-Host "Repository URL: https://github.com/Jakedoes1111/$repoName" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Failed to create repository. Check the error above." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual setup:" -ForegroundColor Yellow
    Write-Host "1. Create repository on GitHub.com: https://github.com/new" -ForegroundColor Yellow
    Write-Host "2. Name it: $repoName" -ForegroundColor Yellow
    Write-Host "3. Run: git remote add origin https://github.com/Jakedoes1111/$repoName.git" -ForegroundColor Yellow
    Write-Host "4. Run: git push -u origin main" -ForegroundColor Yellow
    exit 1
}
