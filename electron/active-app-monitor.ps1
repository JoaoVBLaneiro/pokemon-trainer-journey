param(
  [switch]$List
)

$ErrorActionPreference = "SilentlyContinue"

function Get-AppPath($process) {
  try {
    if ($process.Path) { return $process.Path }
  } catch {}

  try {
    if ($process.MainModule -and $process.MainModule.FileName) {
      return $process.MainModule.FileName
    }
  } catch {}

  return ""
}

if ($List) {
  $apps = Get-Process |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    ForEach-Object {
      [PSCustomObject]@{
        name = $_.ProcessName
        title = $_.MainWindowTitle
        path = Get-AppPath $_
        processId = $_.Id
      }
    }

  @($apps) | ConvertTo-Json -Compress -Depth 3
  exit 0
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class TrainerJourneyForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$lastKey = ""

while ($true) {
  $handle = [TrainerJourneyForegroundWindow]::GetForegroundWindow()
  if ($handle -ne [IntPtr]::Zero) {
    [uint32]$pidValue = 0
    [void][TrainerJourneyForegroundWindow]::GetWindowThreadProcessId($handle, [ref]$pidValue)

    try {
      $process = Get-Process -Id $pidValue -ErrorAction Stop
      $path = Get-AppPath $process
      $name = $process.ProcessName
      $title = $process.MainWindowTitle
      $key = ("{0}|{1}|{2}" -f $path, $name, $process.Id).ToLowerInvariant()

      if ($key -ne $lastKey) {
        $lastKey = $key
        [PSCustomObject]@{
          name = $name
          title = $title
          path = $path
          processId = $process.Id
        } | ConvertTo-Json -Compress
      }
    } catch {}
  }

  Start-Sleep -Milliseconds 550
}
