param(
    [string]$ProjectId = "jplt-511713",
    [string]$Region = "asia-northeast3",
    [string]$ServiceName = "atamp-dag-studio"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 1. GCP CLOUD RUN SERVICE STATUS ($ServiceName)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$svcJson = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format=json | ConvertFrom-Json
$latestReady = $svcJson.status.latestReadyRevisionName
$url = $svcJson.status.url

Write-Host "  Service Name   : $ServiceName ($Region, project=$ProjectId)"
Write-Host "  Active Revision: $latestReady" -ForegroundColor Green
Write-Host "  Service URL    : $url" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 2. LIVE HEALTH & CLOSED-LOOP API CHECK" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$statusResp = Invoke-RestMethod -Uri "$url/api/status" -Method Get
Write-Host "  /api/status ok : $($statusResp.ok) | Shield Mode: $($statusResp.shield_telemetry.shield_mode) | Health: $($statusResp.monitoring_summary.health_score)/100" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 3. RECENT GCP CLOUD RUN LOGS ($latestReady)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$filter = "resource.type=cloud_run_revision AND resource.labels.revision_name=$latestReady"
gcloud logging read $filter --project $ProjectId --limit 15 --format="value(timestamp,textPayload)"
