# Run this script ONCE as Administrator to permanently fix Docker slow/stuck startup.
# Right-click this file → "Run with PowerShell" (or open Admin PowerShell and run it).

# 1. Set Docker Desktop Service to start automatically at Windows login.
#    This ensures the backend engine is ready BEFORE Docker Desktop UI opens.
sc.exe config "com.docker.service" start= auto
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Docker Desktop Service set to Automatic startup" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Could not set service. Are you running as Administrator?" -ForegroundColor Red
    pause
    exit 1
}

# 2. Start the service right now (no reboot needed).
Start-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
$svc = Get-Service -Name "com.docker.service"
Write-Host "[OK] Service status: $($svc.Status) / StartType: $($svc.StartType)" -ForegroundColor Green

Write-Host ""
Write-Host "Done. From now on:" -ForegroundColor Cyan
Write-Host "  - Docker service starts automatically when Windows boots."
Write-Host "  - Docker Desktop auto-starts when you log in (AutoStart already enabled)."
Write-Host "  - No more 'stuck at Starting Docker' on first open after reboot."
Write-Host ""
pause
