# =====================================================================
# Bermatik — siteyi bu bilgisayardan internete açar (Cloudflare geçici tüneli)
#   1) Açık kalmış eski site ve tünel kapatılır
#   2) Tünel başlatılır, yeni https adresi alınır (her başlatmada değişir)
#   3) Adres sitenin ayarına yazılır, site derlenir ve arka planda başlatılır
#   4) Adres masaüstüne "Bermatik-adres.txt" olarak yazılır ve e-postayla gönderilir
# Kayıtlar: %LOCALAPPDATA%\Bermatik\site.log
# Elle çalıştırmak için: powershell -ExecutionPolicy Bypass -File scripts\site-baslat.ps1
# Bilgisayar açılınca kendiliğinden çalışması için: scripts\install-site-task.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$web = Join-Path $root 'apps\web'
$logDir = Join-Path $env:LOCALAPPDATA 'Bermatik'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'site.log'
function Write-Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -FilePath $log -Append -Encoding utf8 }
$desktopFile = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Bermatik-adres.txt'

try {
  Write-Log '--- Başladı ---'

  # 1) Eskileri kapat
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  $old = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
  if ($old) { Stop-Process -Id $old -Force; Start-Sleep -Seconds 2 }

  # 2) Tünel
  $cf = @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $cf) { throw 'cloudflared bulunamadı (winget install Cloudflare.cloudflared)' }
  $tunnelLog = Join-Path $logDir 'tunel.log'
  Remove-Item $tunnelLog -ErrorAction SilentlyContinue
  Start-Process -FilePath $cf -ArgumentList @('tunnel', '--no-autoupdate', '--url', 'http://localhost:3000', '--logfile', "`"$tunnelLog`"") -WindowStyle Hidden
  $url = $null
  for ($i = 0; $i -lt 120 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
  }
  if (-not $url) { throw 'Tünel adresi 2 dakikada alınamadı (internet bağlantısını kontrol edin)' }
  Write-Log "Tünel adresi: $url"

  # 3) Adresi ayarla, derle, başlat
  & node (Join-Path $PSScriptRoot 'site-adres.mjs') ayarla $url | Out-Null
  $env:NODE_OPTIONS = '--max-old-space-size=2048'
  $buildLog = Join-Path $logDir 'derleme.log'
  Push-Location $web
  try {
    & cmd.exe /c "npx next build > `"$buildLog`" 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "Derleme başarısız, ayrıntı: $buildLog" }
  } finally { Pop-Location }
  Write-Log 'Derleme tamam'
  $serverLog = Join-Path $logDir 'sunucu.log'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npx next start -p 3000 >> `"$serverLog`" 2>&1" -WorkingDirectory $web -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
    Start-Sleep -Seconds 2
    try { $ok = (Invoke-WebRequest -Uri 'http://localhost:3000/giris' -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200 } catch { }
  }
  if (-not $ok) { throw "Site 2 dakikada açılmadı, ayrıntı: $serverLog" }
  Write-Log 'Site açık'

  # 4) Adresi bildir
  @(
    'Bermatik sitesinin bugünkü adresi:',
    '',
    $url,
    '',
    "Başlatma zamanı: $(Get-Date -Format 'dd.MM.yyyy HH:mm')",
    'Bilgisayar yeniden başlayınca bu adres değişir.'
  ) | Out-File -FilePath $desktopFile -Encoding utf8
  try { & node (Join-Path $PSScriptRoot 'site-adres.mjs') gonder $url | ForEach-Object { Write-Log $_ } } catch { Write-Log "E-posta gönderilemedi: $_" }
  try { & (Join-Path $PSScriptRoot 'github-link.ps1') $url | ForEach-Object { Write-Log $_ } } catch { Write-Log "GitHub linki güncellenemedi: $_" }
  Write-Log '--- Bitti ---'
  Write-Host "Site açık: $url"
} catch {
  Write-Log "HATA: $_"
  "Bermatik başlatılamadı: $_`r`nAyrıntı: $log" | Out-File -FilePath $desktopFile -Encoding utf8
  throw
}
