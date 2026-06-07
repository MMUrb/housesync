# Accept Android SDK licenses non-interactively by writing Google's known
# license-hash files, then install the packages needed to build (SDK 36).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

# Standard Android SDK license hashes (stable, used widely in CI).
$licenses = @{
  'android-sdk-license'         = @(
    '8933bad161af4178b1185d1a37fbf41ea5269c55',
    'd56f5187479451eabf01fb78af6dfcb131a6481e',
    '24333f8a63b6825ea9c5514f83c2829b004d1fee'
  )
  'android-sdk-preview-license' = @('84831b9409646a918e30573bab4c9c91346d8abd')
  'android-sdk-arm-dbt-license' = @('859f317696f67ef3d7f30a50a5560e7834b43903')
}

$licDir = "$sdk\licenses"
New-Item -ItemType Directory -Force -Path $licDir | Out-Null
foreach ($name in $licenses.Keys) {
  $content = "`n" + ($licenses[$name] -join "`n")
  Set-Content -Path "$licDir\$name" -Value $content -NoNewline -Encoding ascii
  Write-Host "wrote license: $name"
}

$sdkmgr = "$sdk\cmdline-tools\latest\bin\sdkmanager.bat"
Write-Host "==> Installing platform-tools, platforms;android-36, build-tools;36.0.0 ..."
& $sdkmgr --sdk_root="$sdk" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
Write-Host "==> Installed packages:"
& $sdkmgr --sdk_root="$sdk" --list_installed
Write-Host "==> DONE"
