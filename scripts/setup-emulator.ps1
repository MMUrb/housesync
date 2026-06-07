# Installs the Android emulator + a system image and creates an AVD for testing.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

$sdkmgr = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
$avdmgr = "$sdk\cmdline-tools\latest\bin\avdmanager.bat"
$img = "system-images;android-35;google_apis;x86_64"

Write-Host "==> Installing emulator engine + system image ($img) ..."
& $sdkmgr --sdk_root="$sdk" "emulator" "$img"

Write-Host "==> Creating AVD 'housesync' (Pixel 7) ..."
'no' | & $avdmgr create avd -n housesync -k "$img" -d pixel_7 --force

Write-Host "==> Available AVDs:"
& $avdmgr list avd
Write-Host "==> DONE"
