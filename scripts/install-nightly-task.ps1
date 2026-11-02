# =====================================================================
# Bermatik — Gece bakımı görevini Windows Görev Zamanlayıcı'ya ekler
# Her gece 03:00'te scripts\db-nightly.ps1 çalışır (yedek + temizlik + pazar bakımı).
# Bilgisayar o saatte kapalıysa, açıldıktan sonra ilk fırsatta çalışır.
#
# Kurmak : powershell -ExecutionPolicy Bypass -File scripts\install-nightly-task.ps1
# Kaldırmak: Unregister-ScheduledTask -TaskName 'Bermatik Gece Bakimi' -Confirm:$false
# =====================================================================
$script = Join-Path $PSScriptRoot 'db-nightly.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName 'Bermatik Gece Bakimi' -Description 'Bermatik veritabanı yedeği (D:\Bermatik-Yedek), temizlik ve pazar günleri bakım' `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
$info = Get-ScheduledTask -TaskName 'Bermatik Gece Bakimi' | Get-ScheduledTaskInfo
Write-Host "Kuruldu. Bir sonraki çalışma: $($info.NextRunTime)"
