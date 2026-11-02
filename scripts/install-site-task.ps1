# =====================================================================
# Bermatik — bilgisayar açılıp oturum açıldığında siteyi kendiliğinden başlatan görevi kurar
# (scripts\site-baslat.ps1 çalışır; yeni adres masaüstüne yazılır ve e-postayla gelir)
#
# Kurmak : powershell -ExecutionPolicy Bypass -File scripts\install-site-task.ps1
# Kaldırmak: Unregister-ScheduledTask -TaskName 'Bermatik Site' -Confirm:$false
# =====================================================================
$script = Join-Path $PSScriptRoot 'site-baslat.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = 'PT1M'  # oturum açıldıktan 1 dakika sonra (internet ve SQL Server hazır olsun)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'Bermatik Site' -Description 'Bermatik sitesini bu bilgisayardan internete açar (Cloudflare tüneli)' `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host 'Kuruldu. Bilgisayar her açıldığında site kendiliğinden başlayacak; adres masaüstündeki Bermatik-adres.txt dosyasına yazılır.'
