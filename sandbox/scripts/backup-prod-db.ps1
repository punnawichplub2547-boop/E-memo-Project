<#
.SYNOPSIS
    Backup the HR&GA E-Memo production database + attachment volume.

.DESCRIPTION
    Run this ON the prod server (10.255.255.173) via TightVNC, from anywhere - it
    locates the repo relative to its own path, same as deploy-prod.ps1. Produces:
      - <Destination>\db_<timestamp>.sql          (mysqldump, utf8mb4-safe)
      - <Destination>\attachments_<timestamp>.tar.gz  (hr-ememo-attachments-data volume)
    Then deletes backup files in <Destination> older than -RetentionDays.

    Run this BEFORE any deploy that changes the DB schema (new migrations), and
    before any docker compose command that touches volumes (e.g. "down -v").

.PARAMETER Destination
    Folder to write backup files into. Created if missing. Default: D:\Hr\backup
    (the existing backup folder already used on the prod server - shared with
    other backups there, so files are named db_*/attachments_* to avoid clashes).

.PARAMETER RetentionDays
    Backup files older than this many days are deleted after a successful backup.
    Only files matching this script's own naming pattern (db_*.sql,
    attachments_*.tar.gz) are ever touched - other files in Destination are left
    alone. Default: 7

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\backup-prod-db.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\backup-prod-db.ps1 -Destination E:\backups -RetentionDays 14
#>
[CmdletBinding()]
param(
    [string]$Destination = 'D:\Hr\backup',
    [int]$RetentionDays = 7
)

$ErrorActionPreference = 'Stop'

# --- Config -----------------------------------------------------------------
$DbContainer   = 'hr-ememo-db'
$DbName        = 'hr_ememo'
$AttachVolume  = 'hr-ememo-attachments-data'
$Timestamp     = Get-Date -Format 'yyyy-MM-dd_HHmm'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    [!]  $msg" -ForegroundColor Yellow }

function Test-ContainerRunning($name) {
    $state = (docker inspect -f '{{.State.Running}}' $name 2>$null)
    return ($state -eq 'true')
}

# --- 0. Prep ------------------------------------------------------------
Write-Step "Backup destination: $Destination (retention: $RetentionDays days)"
if (-not (Test-Path $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Write-Ok "created $Destination"
}

if (-not (Test-ContainerRunning $DbContainer)) {
    throw "$DbContainer is not running - start it first (docker compose up -d $DbContainer)."
}

# --- 1. Database dump -----------------------------------------------------
Write-Step "Dumping database '$DbName' from $DbContainer"
$rootPw = (docker exec $DbContainer printenv MYSQL_ROOT_PASSWORD).Trim()
if (-not $rootPw) { throw "Could not read MYSQL_ROOT_PASSWORD from $DbContainer." }

$dbBackupFile = Join-Path $Destination "db_$Timestamp.sql"
# MYSQL_PWD env avoids the password-on-CLI warning; --default-character-set=utf8mb4
# is mandatory here - Thai text otherwise gets mangled the same way described in
# db/migrations/README.md (see ERR-0013-style mojibake, same root cause class).
$inner = "docker exec -e MYSQL_PWD=$rootPw $DbContainer mysqldump --default-character-set=utf8mb4 -uroot $DbName > `"$dbBackupFile`""
cmd /c $inner
if ($LASTEXITCODE -ne 0) { throw "mysqldump failed (exit $LASTEXITCODE)." }
if (-not (Test-Path $dbBackupFile) -or (Get-Item $dbBackupFile).Length -eq 0) {
    throw "mysqldump produced an empty file - treat this backup as failed."
}
Write-Ok "wrote $dbBackupFile ($([math]::Round((Get-Item $dbBackupFile).Length / 1MB, 2)) MB)"

# --- 2. Attachments volume -------------------------------------------------
Write-Step "Archiving attachments volume '$AttachVolume'"
$attachBackupFile = Join-Path $Destination "attachments_$Timestamp.tar.gz"
docker run --rm -v "${AttachVolume}:/data" -v "${Destination}:/backup" alpine `
    tar czf "/backup/attachments_$Timestamp.tar.gz" -C /data .
if ($LASTEXITCODE -ne 0) { throw "attachments archive failed (exit $LASTEXITCODE)." }
Write-Ok "wrote $attachBackupFile ($([math]::Round((Get-Item $attachBackupFile).Length / 1MB, 2)) MB)"

# --- 3. Prune old backups ---------------------------------------------------
Write-Step "Pruning backups older than $RetentionDays days in $Destination"
$cutoff = (Get-Date).AddDays(-$RetentionDays)
$old = Get-ChildItem -Path $Destination -File |
    Where-Object { ($_.Name -like 'db_*.sql' -or $_.Name -like 'attachments_*.tar.gz') -and $_.LastWriteTime -lt $cutoff }
if ($old) {
    $old | ForEach-Object { Write-Warn2 "deleting $($_.Name) (from $($_.LastWriteTime.ToString('yyyy-MM-dd')))"; Remove-Item $_.FullName -Force }
} else {
    Write-Ok "nothing to prune"
}

Write-Step "Done."
Write-Host "    DB backup:          $dbBackupFile" -ForegroundColor DarkGray
Write-Host "    Attachments backup: $attachBackupFile" -ForegroundColor DarkGray
