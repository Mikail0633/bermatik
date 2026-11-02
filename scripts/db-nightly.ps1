# =====================================================================
# Bermatik — Gece bakımı (Windows Görev Zamanlayıcı her gece 03:00'te çalıştırır;
# bilgisayar o saatte kapalıysa açıldığında çalışır)
#   1) Yedek: veritabanı sıkıştırılıp yedeklenir, doğrulanır, D:\Bermatik-Yedek'e kopyalanır;
#      fotoğraf ve belge dosyaları D:\Bermatik-Yedek\dosyalar'a eşitlenir
#   2) Son 14 günün yedeği saklanır, eskileri silinir
#   3) Temizlik: süresi dolmuş oturumlar, eski bildirimler vb. (data.usp_NightlyCleanup)
#   4) Pazar günleri: dizin ve istatistik bakımı (data.usp_WeeklyMaintenance)
# Sonuçlar D:\Bermatik-Yedek\bakim.log dosyasına yazılır.
# Elle çalıştırmak için: powershell -ExecutionPolicy Bypass -File scripts\db-nightly.ps1
# =====================================================================
param(
  [string]$Server = 'localhost',
  [string]$Database = 'Bermatik',
  [string]$BackupDir = 'D:\Bermatik-Yedek',
  [int]$KeepDays = 14
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$log = Join-Path $BackupDir 'bakim.log'
function Write-Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -FilePath $log -Append -Encoding utf8 }
function Invoke-Sql($query, $db = $Database) {
  $out = & sqlcmd -S $Server -E -C -b -I -f 65001 -d $db -h -1 -W -Q $query 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
  return ($out | Where-Object { $_ -and $_.Trim() }) -join ' '
}

try {
  Write-Log '--- Başladı ---'

  # 1) Yedek: SQL Server doğrudan D diskine yazar (klasöre yazma izni kurulumda verildi:
  #    icacls D:\Bermatik-Yedek /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)M")
  $name = "${Database}_$(Get-Date -Format 'yyyyMMdd_HHmm').bak"
  $file = Join-Path $BackupDir $name
  Invoke-Sql "BACKUP DATABASE [$Database] TO DISK = N'$file' WITH COMPRESSION, CHECKSUM, INIT, NAME = N'Bermatik gece yedegi'; RESTORE VERIFYONLY FROM DISK = N'$file' WITH CHECKSUM;" 'master' | Out-Null
  $sizeMb = [math]::Round((Get-Item $file).Length / 1MB, 1)
  Write-Log "Yedek alındı ve doğrulandı: $name ($sizeMb MB)"

  # 1b) Dosyalar: fotoğraflar (storage\foto) ve doğrulama belgeleri (storage\dogrulama) veritabanında değil,
  #     diskte durur. Yedek klasörüne eşitlenir: yalnızca yeni/değişen dosyalar kopyalanır; sitede silinen
  #     dosya (ör. KVKK gereği silinen hesap belgesi) yedekten de silinir.
  $storage = Join-Path $PSScriptRoot '..\apps\web\storage'
  if (Test-Path $storage) {
    $dest = Join-Path $BackupDir 'dosyalar'
    & robocopy $storage $dest /MIR /R:2 /W:5 /NP /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Dosya yedeği alınamadı (robocopy kodu $LASTEXITCODE)" }
    $n = (Get-ChildItem $dest -Recurse -File | Measure-Object).Count
    Write-Log "Dosya yedeği eşitlendi: $n dosya ($dest)"
    $global:LASTEXITCODE = 0
  }

  # 2) Eski yedekleri sil
  $old = Get-ChildItem -Path $BackupDir -Filter "${Database}_*.bak" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
  $old | Remove-Item -Force
  if ($old) { Write-Log "Eski yedek silindi: $($old.Count) adet" }

  # 3) Gece temizliği
  $c = Invoke-Sql 'SET NOCOUNT ON; EXEC data.usp_NightlyCleanup;'
  Write-Log "Temizlik (oturum, kod, bildirim, cihaz, sıra, şikayet, kayıt, güvenlik): $c"

  # 4) Haftalık bakım ve OpenStreetMap güncellemesi (pazar)
  if ((Get-Date).DayOfWeek -eq 'Sunday') {
    $m = Invoke-Sql 'SET NOCOUNT ON; EXEC data.usp_WeeklyMaintenance;'
    Write-Log "Haftalık bakım (yeniden kurulan, düzenlenen dizin): $m"
    # Yeni eklenen gerçek dükkânlar gelir; sahiplenilmiş / admin'in düzenlediği dükkânlara dokunulmaz
    try {
      $osm = & node (Join-Path $PSScriptRoot 'import-osm.mjs') --db $Database --bbox '39.30,31.90,40.70,33.90' 2>&1 | Select-Object -Last 3
      Write-Log "OpenStreetMap güncellemesi: $($osm -join ' ')"
    } catch { Write-Log "OpenStreetMap güncellemesi yapılamadı: $($_.Exception.Message)" }
  }
  Write-Log '--- Bitti ---'
}
catch {
  Write-Log "HATA: $($_.Exception.Message)"
  exit 1
}
