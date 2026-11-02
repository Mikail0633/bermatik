# =====================================================================
# Bermatik — GitHub'daki sabit linki (https://mikail0633.github.io/bermatik)
# sitenin o anki tünel adresine yönlendirir.
#   Depo: github.com/Mikail0633/bermatik
#     main     = projenin kodu (buraya DOKUNULMAZ)
#     gh-pages = yalnızca index.html (yönlendirme) + adres.json; GitHub Pages buradan yayınlanır
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts\github-link.ps1 https://xxx.trycloudflare.com
# site-baslat.ps1 her açılışta bunu kendiliğinden çalıştırır.
# =====================================================================
param([Parameter(Mandatory = $true)][string]$Url)
$ErrorActionPreference = 'Continue'  # gh stderr'e yazınca PS 5.1 hata saymasın; LASTEXITCODE kontrol ediliyor
$repo = 'Mikail0633/bermatik'
$pages = 'https://mikail0633.github.io/bermatik/'
if ($Url -notmatch '^https://[a-z0-9.-]+(/.*)?$') { throw "Geçersiz adres: $Url" }
$Url = $Url.TrimEnd('/')
$now = Get-Date -Format 'dd.MM.yyyy HH:mm'

$html = @"
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bermatik</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0b;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:16px}
  a{color:#d4af37;font-weight:600}
</style>
</head>
<body>
<div>
  <h1>Bermatik</h1>
  <p>Siteye yönlendiriliyorsunuz…</p>
  <p><a id="git" href="$Url">Açılmazsa buraya dokunun</a></p>
</div>
<script>
  var yedek = "$Url";
  function git(u){ document.getElementById("git").href = u; location.replace(u + location.pathname.replace(/^\/bermatik\/?/, "/") + location.search); }
  fetch("adres.json?t=" + Date.now(), {cache: "no-store"})
    .then(function(r){ return r.json(); })
    .then(function(d){ git(d.url || yedek); })
    .catch(function(){ git(yedek); });
</script>
</body>
</html>
"@

$json = (@{ url = $Url; guncellendi = $now } | ConvertTo-Json -Compress)

$branch = 'gh-pages'

function Put-File([string]$path, [string]$content) {
  $sha = $null
  try { $sha = (gh api "repos/$repo/contents/$($path)?ref=$branch" --jq .sha 2>$null) } catch { }
  $body = @{
    message = "Adres güncellendi: $now"
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))
    branch  = $branch
  }
  if ($sha) { $body.sha = $sha.Trim() }
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
    gh api -X PUT "repos/$repo/contents/$path" --input $tmp --silent
    if ($LASTEXITCODE -ne 0) { throw "$path yüklenemedi" }
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

gh api "repos/$repo/branches/$branch" --silent 2>$null
if ($LASTEXITCODE -ne 0) { throw "$repo deposunda $branch dalı yok" }

Put-File 'adres.json' $json
Put-File 'index.html' $html
Write-Output "GitHub linki güncellendi: $pages -> $Url"
