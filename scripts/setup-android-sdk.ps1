# Headless Android SDK setup for building the HouseSync app.
# Downloads Google command-line tools, installs platform/build-tools for SDK 36,
# accepts all licenses, and points the Capacitor project at the SDK.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # huge speedup for Invoke-WebRequest

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$jbr = "C:\Program Files\Android\Android Studio\jbr"
$env:JAVA_HOME = $jbr
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

Write-Host "==> SDK root: $sdk"
New-Item -ItemType Directory -Force -Path $sdk | Out-Null

# 1. Discover the current command-line tools download URL from Google's repo manifest.
Write-Host "==> Discovering command-line tools URL..."
$manifest = (Invoke-WebRequest "https://dl.google.com/android/repository/repository2-1.xml" -UseBasicParsing).Content
$file = [regex]::Match($manifest, 'commandlinetools-win-\d+_latest\.zip').Value
if (-not $file) { throw "Could not find cmdline-tools URL in manifest" }
$url = "https://dl.google.com/android/repository/$file"
Write-Host "==> $url"

# 2. Download + extract into <sdk>\cmdline-tools\latest
$zip = "$env:TEMP\android-cmdline-tools.zip"
Write-Host "==> Downloading command-line tools..."
Invoke-WebRequest $url -OutFile $zip -UseBasicParsing
$tmp = "$env:TEMP\android-cmdline-extract"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive $zip -DestinationPath $tmp -Force
$dest = "$sdk\cmdline-tools\latest"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Move-Item "$tmp\cmdline-tools\*" $dest -Force
Write-Host "==> Extracted to $dest"

$sdkmgr = "$dest\bin\sdkmanager.bat"

# 3. Accept all licenses (feed many 'y').
Write-Host "==> Accepting licenses..."
$yes = (1..100 | ForEach-Object { 'y' })
$yes | & $sdkmgr --sdk_root="$sdk" --licenses | Out-Null

# 4. Install the packages Capacitor needs (SDK 36).
Write-Host "==> Installing platform-tools, platforms;android-36, build-tools;36.0.0 ..."
$yes | & $sdkmgr --sdk_root="$sdk" "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# 5. Persist ANDROID_HOME for future sessions + write local.properties for Gradle.
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $sdk, "User")
$localProps = "C:\Users\Rahul\Desktop\housesync\android\local.properties"
"sdk.dir=$($sdk -replace '\\','/')" | Out-File -FilePath $localProps -Encoding ascii
Write-Host "==> Wrote $localProps"

Write-Host "==> Verifying installed packages:"
& $sdkmgr --sdk_root="$sdk" --list_installed
Write-Host "==> DONE"
