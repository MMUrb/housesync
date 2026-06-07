# Waits for the emulator to boot, checks browser availability (needed for the
# OAuth system-browser tab), and installs the rebuilt APK.
$ErrorActionPreference = 'Stop'
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$adb = "$sdk\platform-tools\adb.exe"
$apk = "C:\Users\Rahul\Desktop\housesync\android\app\build\outputs\apk\debug\app-debug.apk"

Write-Host "==> waiting for device..."
& $adb wait-for-device
Write-Host "==> waiting for boot..."
for ($i = 0; $i -lt 80; $i++) {
  $bc = (& $adb shell getprop sys.boot_completed | Out-String).Trim()
  if ($bc -eq '1') { break }
  Start-Sleep -Seconds 3
}
Write-Host "booted after ~$($i*3)s"
Start-Sleep -Seconds 3

Write-Host "==> browser / chrome packages present:"
& $adb shell pm list packages | Select-String -Pattern "chrome|android.browser|webview"

Write-Host "==> default handler for an https VIEW intent:"
& $adb shell cmd package resolve-activity --brief -a android.intent.action.VIEW -d "https://example.com"

Write-Host "==> installing rebuilt APK..."
& $adb install -r $apk
Write-Host "==> DONE"
