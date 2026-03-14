$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$triggerPath = ".github/refresh-trigger.txt"
$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

"manual-refresh: $stamp" | Set-Content $triggerPath -NoNewline

 git add $triggerPath
 git commit -m "chore: trigger manual README refresh"
 git pull --rebase origin main
 git push origin main

Write-Host "Manual refresh trigger pushed. Check GitHub Actions for 'Auto Update README Data'."
