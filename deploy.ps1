param(
    [string]$ProjectId = "jplt-511713",
    [string]$Region = "asia-northeast3",
    [string]$ServiceName = "atamp-dag-studio"
)

$ErrorActionPreference = "Stop"

Write-Host "Building production frontend bundle (dist/)..." -ForegroundColor Cyan
Push-Location $PSScriptRoot
try {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun run build
    } else {
        npm run build
    }

    Write-Host "Deploying $ServiceName PoC to GCP Cloud Run ($Region, project=$ProjectId)..." -ForegroundColor Cyan
    gcloud run deploy $ServiceName `
        --source . `
        --region $Region `
        --project $ProjectId `
        --port 8080 `
        --min-instances 0 `
        --max-instances 2 `
        --memory 512Mi `
        --cpu 1 `
        --allow-unauthenticated `
        --set-env-vars "NODE_ENV=production,TZ=Asia/Seoul" `
        --quiet
} finally {
    Pop-Location
}
