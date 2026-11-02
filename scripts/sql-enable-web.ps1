# =====================================================================
# Bermatik — SQL Server'ı web sitesinin bağlanabileceği hale getirir
# YÖNETİCİ olarak çalıştırılmalıdır (Başlat → PowerShell → sağ tık → Yönetici olarak çalıştır).
#
#   1) TCP/IP bağlantısını açar (port 1433)
#   2) "SQL Server + Windows" giriş modunu açar (site kendi kısıtlı kullanıcısıyla bağlanır)
#   3) SQL Server'ı yeniden başlatır (birkaç saniye)
#
# Dışarıdan erişim AÇILMAZ: Windows Güvenlik Duvarı'na kural eklenmez; port yalnızca
# bu bilgisayardan kullanılabilir.
# Geri almak için: aynı değerleri Tcp Enabled=0 ve LoginMode=1 yapıp servisi yeniden başlatın.
# =====================================================================
$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Bu dosya yönetici olarak çalıştırılmalı. PowerShell''i "Yönetici olarak çalıştır" ile açıp tekrar deneyin.' -ForegroundColor Red
  exit 1
}

$inst = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL').MSSQLSERVER
$base = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$inst\MSSQLServer"

# 1) TCP/IP aç, sabit port 1433
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp" -Name Enabled -Value 1
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name TcpPort -Value '1433'
Set-ItemProperty -Path "$base\SuperSocketNetLib\Tcp\IPAll" -Name TcpDynamicPorts -Value ''

# 2) Karma giriş modu (Windows + SQL Server)
Set-ItemProperty -Path $base -Name LoginMode -Value 2

# 3) Yeniden başlat
Write-Host 'SQL Server yeniden başlatılıyor...'
Restart-Service -Name MSSQLSERVER -Force
Start-Sleep -Seconds 3
$ok = Test-NetConnection -ComputerName localhost -Port 1433 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($ok) { Write-Host 'Tamam: SQL Server 1433 portunda bağlantı kabul ediyor.' -ForegroundColor Green }
else { Write-Host 'SQL Server yeniden başladı ama 1433 portu henüz yanıt vermiyor; birkaç saniye sonra tekrar deneyin.' -ForegroundColor Yellow }
