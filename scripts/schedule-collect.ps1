<#
.SYNOPSIS
  Registers a Windows scheduled task that runs the news + oil collector daily,
  so data stays fresh even when the dev server isn't running.

.EXAMPLE
  npm run schedule:install               # daily at 09:00
  npm run schedule:install -- -At 06:30  # pick another time
  npm run schedule:status
  npm run schedule:remove

.NOTES
  - Runs as the current user, only while logged on, with no console window.
  - "Start when available" catches up after the PC was off at the scheduled time.
  - Output goes to logs/collect.log (git-ignored).
  - macOS/Linux: use cron instead, e.g. `0 9 * * * cd /path/to/folder && npm run collect`.
#>
param(
  [ValidateSet('install', 'remove', 'status')]
  [string]$Action = 'install',
  [string]$At = '09:00',
  [string]$TaskName = 'GlobalTensionDashboard-Collect'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

switch ($Action) {
  'remove' {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
      Write-Host "Removed scheduled task '$TaskName'."
    } else {
      Write-Host "No scheduled task named '$TaskName'."
    }
    return
  }
  'status' {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) { Write-Host "Not installed."; return }
    $info = $task | Get-ScheduledTaskInfo
    Write-Host "State:       $($task.State)"
    Write-Host "Last run:    $($info.LastRunTime) (result $($info.LastTaskResult))"
    Write-Host "Next run:    $($info.NextRunTime)"
    Write-Host "Log:         $(Join-Path $root 'logs\collect.log')"
    return
  }
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node was not found on PATH. Install Node.js first.' }
if (-not (Test-Path (Join-Path $root 'node_modules\tsx\dist\cli.mjs'))) {
  throw 'Dependencies are missing. Run "npm install" first.'
}

# conhost --headless keeps a console window from flashing up. Logging happens
# inside collect-scheduled.mjs, so no shell redirection (and nested quoting) is needed.
$taskAction = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless `"$node`" scripts\collect-scheduled.mjs" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
  -RunOnlyIfNetworkAvailable
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive

Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger `
  -Settings $settings -Principal $principal `
  -Description 'Collects Global Tension Dashboard news and oil prices.' -Force | Out-Null

Write-Host "Scheduled '$TaskName' daily at $At."
Write-Host "Run it now with: Start-ScheduledTask -TaskName $TaskName"
