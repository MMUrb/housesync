# Waits for the emulator to boot, installs the HouseSync APK, launches it,
# and captures a screenshot of the running app.
$ErrorActionPreference = 'Stop'
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$adb = "$sdk\platform-tools\adb.exe"
$apk = "C:\Users\Rahul\Desktop\housesync\android\app\build\outputs\apk\debug\app-debug.apk"
$shot = "C:\Users\Rahul\Desktop\housesync\emulator-screenshot.png"

Write-Host "==> Waiting for full boot..."
$booted = $false
for ($i = 0; $i -lt 80; $i++) {
  $bc = (& $adb shell getprop sys.boot_completed | Out-String).Trim()
  if ($bc -eq '1') { $booted = $true; break }
  Start-Sleep -Seconds 3
}
Write-Host "==> booted=$booted after ~$($i*3)s"
if (-not $booted) { throw "Emulator did not finish booting" }
Start-Sleep -Seconds 4

Write-Host "==> Installing APK..."
& $adb install -r $apk

Write-Host "==> Launching app (uk.co.housesync)..."
& $adb shell monkey -p uk.co.housesync -c android.intent.category.LAUNCHER 1

Write-Host "==> Waiting for the live site to load in the webview..."
Start-Sleep -Seconds 20

Write-Host "==> Capturing screenshot..."
& $adb shell screencap -p /sdcard/hs_shot.png
& $adb pull /sdcard/hs_shot.png $shot
Write-Host "==> Screenshot saved: $shot"
Write-Host "==> DONE"
