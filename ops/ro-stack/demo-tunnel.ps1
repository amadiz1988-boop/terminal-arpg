[CmdletBinding()]
param([Parameter(Mandatory=$true,Position=0)][ValidateSet('start','stop','health')][string]$Action)

$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtime=Join-Path $projectRoot '.local\ro-stack\dashboard'
$statePath=Join-Path $runtime 'tunnel-state.json'

function Get-TunnelProcess {
  if(-not(Test-Path $statePath)){return $null}
  try{$state=Get-Content $statePath -Raw|ConvertFrom-Json;$process=Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue;if($process -and $process.ProcessName -eq 'cloudflared'){return $process}}catch{}
  return $null
}

if($Action -eq 'stop'){
  $process=Get-TunnelProcess;if($process){Stop-Process -Id $process.Id -Force}
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-Host 'Demo tunnel stopped.';exit 0
}
if($Action -eq 'health'){
  $process=Get-TunnelProcess;if(-not$process){Write-Host 'DEMO_TUNNEL_OFFLINE';exit 1}
  $state=Get-Content $statePath -Raw|ConvertFrom-Json;Write-Host "DEMO_TUNNEL_HEALTHY $($state.publicUrl)";exit 0
}

$existing=Get-TunnelProcess
if($existing){$state=Get-Content $statePath -Raw|ConvertFrom-Json;Write-Host $state.publicUrl;exit 0}
New-Item -ItemType Directory -Force -Path $runtime|Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$stdout=Join-Path $runtime "$stamp-tunnel.out.log";$stderr=Join-Path $runtime "$stamp-tunnel.err.log"
$cloudflared=(Get-Command cloudflared -ErrorAction Stop).Source
$process=Start-Process -FilePath $cloudflared -ArgumentList @('tunnel','--url','http://127.0.0.1:8788','--no-autoupdate') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$deadline=(Get-Date).AddSeconds(35);$publicUrl=$null
do{Start-Sleep -Milliseconds 500;if($process.HasExited){break};$content=((Get-Content $stdout,$stderr -Raw -ErrorAction SilentlyContinue)-join"`n");$match=[regex]::Match($content,'https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com');if($match.Success){$publicUrl=$match.Value;break}}while((Get-Date)-lt$deadline)
if(-not$publicUrl){Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue;throw "Tunnel startup timed out. See $stderr"}
@{pid=$process.Id;startedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();publicUrl=$publicUrl;stdout=$stdout;stderr=$stderr}|ConvertTo-Json|Set-Content $statePath -Encoding utf8
Write-Host $publicUrl
