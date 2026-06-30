<#
.SYNOPSIS
    One-shot production deploy for HR&GA E-Memo (Windows + Docker @ prod server).

.DESCRIPTION
    Run this ON the prod server (10.255.255.173) via TightVNC, from anywhere - it
    locates the repo relative to its own path. Steps:
      1. git pull origin main
      2. Apply only the DB migrations whose table is still missing (idempotent)
      3. Sanity-check the app container env (APP_PUBLIC_BASE_URL / AUTH_COOKIE_SECURE)
      4. docker compose up -d --build  (rebuilds app only; the cloudflared Windows
         service is OUTSIDE compose, so the tunnel stays up - brief app downtime only)
      5. Wait for the app to answer on http://localhost:3000/login

    Safe to re-run: migrations are skipped when their table already exists, and all
    migration files use CREATE TABLE IF NOT EXISTS.

.PARAMETER DryRun
    Show what would happen (pull / migrations / rebuild) without changing anything.

.PARAMETER SkipPull
    Skip "git pull" (use when you already pulled or are deploying a local checkout).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1 -DryRun
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$SkipPull
)

$ErrorActionPreference = 'Stop'

# --- Config ---------------------------------------------------------------
$DbContainer  = 'hr-ememo-db'
$AppContainer = 'hr-ememo-sandbox'
$DbName       = 'hr_ememo'
$DbUser       = 'hr_ememo'
$AppUrl       = 'http://localhost:3000/login'

# Ordered map: table marker -> migration file. A migration runs ONLY if its table
# is absent. Add future migrations here (keep chronological order).
$Migrations = [ordered]@{
    'issue_reports'         = '2026-06-24-issue-reports-table.sql'
    'item_subcategories'    = '2026-06-25-item-subcategories.sql'
    'password_reset_tokens' = '2026-06-29-password-reset-tokens.sql'
}

# --- Helpers --------------------------------------------------------------
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    [!]  $msg" -ForegroundColor Yellow }

function Test-ContainerRunning($name) {
    $state = (docker inspect -f '{{.State.Running}}' $name 2>$null)
    return ($state -eq 'true')
}

function Test-TableExists($pw, $table) {
    $q = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DbName' AND table_name='$table';"
    $out = docker exec -e "MYSQL_PWD=$pw" $DbContainer mysql -N -B "-u$DbUser" $DbName -e $q 2>$null
    if (-not $out) { return $false }
    $val = ("$out" -split "\r?\n" | Where-Object { $_ -ne '' } | Select-Object -Last 1)
    return (($val).Trim() -eq '1')
}

# --- 0. Locate repo -------------------------------------------------------
$RepoRoot = Split-Path $PSScriptRoot -Parent   # scripts/ -> sandbox/
Set-Location $RepoRoot
if (-not (Test-Path (Join-Path $RepoRoot 'compose.yaml'))) {
    throw "compose.yaml not found in $RepoRoot - run this from the cloned repo's sandbox folder."
}
Write-Step "Repo: $RepoRoot   (DryRun=$DryRun, SkipPull=$SkipPull)"

# --- 1. git pull ----------------------------------------------------------
Write-Step "git pull origin main"
if ($SkipPull) {
    Write-Warn2 "skipped (-SkipPull)"
} elseif ($DryRun) {
    # NOTE: do NOT pipe native stderr via 2>&1 under ErrorActionPreference=Stop in
    # Windows PowerShell 5.1 - git writes normal progress to stderr and it gets
    # wrapped as a terminating NativeCommandError. Let it go straight to the console.
    git fetch origin main
    Write-Warn2 "DryRun: would fast-forward to origin/main:"
    git --no-pager log --oneline HEAD..origin/main
} else {
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw "git pull failed (exit $LASTEXITCODE)." }
    Write-Ok "pulled"
}

# --- 2. DB up? ------------------------------------------------------------
Write-Step "Check DB container '$DbContainer'"
if (-not (Test-ContainerRunning $DbContainer)) {
    if ($DryRun) {
        Write-Warn2 "DB not running - DryRun can't inspect tables; will assume migrations may be needed."
    } else {
        Write-Warn2 "DB container not running - starting it first so migrations can apply."
        docker compose up -d $DbContainer
        Start-Sleep -Seconds 8
    }
}

# --- 3. Migrations --------------------------------------------------------
Write-Step "Migrations (run only if table missing)"
$pw = $null
if (Test-ContainerRunning $DbContainer) {
    $pw = (docker exec $DbContainer printenv MYSQL_PASSWORD).Trim()
    if (-not $pw) { throw "Could not read MYSQL_PASSWORD from $DbContainer." }
}

foreach ($table in $Migrations.Keys) {
    $file = $Migrations[$table]
    $full = Join-Path (Join-Path $RepoRoot 'db\migrations') $file
    if (-not (Test-Path $full)) { Write-Warn2 "missing file $file - skipped"; continue }

    $exists = $false
    if ($pw) { $exists = Test-TableExists $pw $table }

    if ($exists) {
        Write-Ok "$table already present - skip $file"
        continue
    }

    if ($DryRun) {
        Write-Warn2 "DryRun: would apply $file (table '$table' absent)"
        continue
    }

    Write-Host "    applying $file ..." -ForegroundColor White
    # OS-level (<) redirect via cmd so UTF-8 Thai bytes reach mysql untouched
    # (PowerShell pipelines would re-encode and mojibake Thai). MYSQL_PWD avoids
    # the password-on-CLI warning; --default-character-set=utf8mb4 is mandatory.
    $inner = "docker exec -e MYSQL_PWD=$pw -i $DbContainer mysql --default-character-set=utf8mb4 -u$DbUser $DbName < `"$full`""
    cmd /c $inner
    if ($LASTEXITCODE -ne 0) { throw "Migration $file failed (exit $LASTEXITCODE)." }
    if (-not (Test-TableExists $pw $table)) { throw "Migration $file ran but table '$table' still missing." }
    Write-Ok "applied $file"
}

# --- 4. Env sanity (warn only) -------------------------------------------
Write-Step "Env sanity check (.env.local + running app container)"
$envFile = Join-Path $RepoRoot '.env.local'
$envText = if (Test-Path $envFile) { Get-Content $envFile -Raw } else { '' }

function Check-Env($key, $hint) {
    $inFile = $envText -match "(?m)^\s*$([regex]::Escape($key))\s*="
    if ($inFile) { Write-Ok "$key set in .env.local" }
    else { Write-Warn2 "$key NOT in .env.local - $hint" }
}
Check-Env 'APP_PUBLIC_BASE_URL' 'password-reset links break without it (set https://memo.car-1996.com)'
Check-Env 'TELEGRAM_BOT_TOKEN'  'Telegram push disabled if unset (optional)'
# AUTH_COOKIE_SECURE: not checked here on purpose. With NODE_ENV=production (set in
# compose) the app defaults to a Secure cookie, so leaving it unset is correct on
# prod. Only set AUTH_COOKIE_SECURE=false in .env.local to test over plain http.
Write-Ok 'AUTH_COOKIE_SECURE: defaults to Secure on prod (NODE_ENV=production) - no action needed'

# --- 5. Rebuild -----------------------------------------------------------
Write-Step "docker compose up -d --build  (app rebuild; tunnel service unaffected)"
if ($DryRun) {
    Write-Warn2 "DryRun: skipping rebuild"
} else {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "docker compose up --build failed (exit $LASTEXITCODE)." }
    Write-Ok "compose up done"

    Write-Step "Waiting for app at $AppUrl"
    $deadline = (Get-Date).AddSeconds(120)
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $healthy = $true; break }
        } catch { Start-Sleep -Seconds 3 }
    }
    if ($healthy) { Write-Ok "app responding 200 on /login" }
    else { Write-Warn2 "app did not return 200 within 120s - check 'docker compose logs -f $AppContainer'" }
}

Write-Step "Done."
Write-Host @"
    Reminders:
    - Tunnel (cloudflared 'ememo' Windows service) was NOT touched - verify public
      reachability: open https://memo.car-1996.com/login from an off-network device.
    - If you changed APP_PUBLIC_BASE_URL/webhook env, re-run: npm run telegram:set-webhook
    - DB is still demo/test data; backup before this run is optional but cheap:
        docker exec $DbContainer sh -c 'exec mysqldump --default-character-set=utf8mb4 -uroot -p`$MYSQL_ROOT_PASSWORD $DbName' > backup.sql
"@ -ForegroundColor DarkGray
