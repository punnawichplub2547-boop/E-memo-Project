# One-command deploy for the HR&GA E-Memo sandbox (Windows server).
#
# Run it from the sandbox folder, EITHER:
#   - in PowerShell:   .\deploy.ps1
#   - from cmd.exe:    powershell -ExecutionPolicy Bypass -File deploy.ps1
#
# What it does:
#   1. git pull --ff-only origin main   (refuses to auto-merge a diverged tree)
#   2. shows which commits arrived
#   3. flags any changed db/migrations/ files -- but NEVER runs them
#   4. rebuilds + restarts the app AND db images (named volumes persist)
#   5. health-checks the app and reports the result
#
# It never touches the database (no migrations, seed, or data repair) and never
# removes volumes. Apply migrations / data fixes by hand (see db/migrations/README.md).

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$branch    = "main"
$healthUrl = "http://localhost:3000/login"

Write-Host "==> Deploy: origin/$branch"
$old = (git rev-parse HEAD).Trim()

Write-Host "==> git pull --ff-only origin $branch"
git pull --ff-only origin $branch
if ($LASTEXITCODE -ne 0) { throw "git pull failed (local changes or diverged tree?). Resolve by hand." }
$new = (git rev-parse HEAD).Trim()

if ($old -eq $new) {
  Write-Host "==> Already at latest ($new) -- rebuilding anyway."
} else {
  Write-Host "==> $old -> $new"
  git log --oneline "$old..$new"
}

$mig = git diff --name-only $old $new -- db/migrations/
if ($mig) {
  Write-Host ""
  Write-Host "!!  db/migrations changed -- review and run BY HAND if needed"
  Write-Host "!!  (see db/migrations/README.md):"
  $mig | ForEach-Object { Write-Host "      $_" }
}

Write-Host ""
Write-Host "==> Rebuild + restart (app + db)"
docker compose -f compose.yaml up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose failed" }

Write-Host "==> Health check: $healthUrl"
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}

if ($ok) {
  Write-Host "==> OK -- app responding (HTTP 200). Deployed $new."
} else {
  Write-Host "!!  App not responding after ~60s. Check: docker compose logs --tail=50 hr-ememo-sandbox"
  exit 1
}
