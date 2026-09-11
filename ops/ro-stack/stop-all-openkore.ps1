$ErrorActionPreference='Continue'
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$instancesRoot=Join-Path $projectRoot '.local\ro-stack\instances'
if(Test-Path $instancesRoot){
  foreach($folder in Get-ChildItem $instancesRoot -Directory){
    & (Join-Path $PSScriptRoot 'openkore-instance.ps1') stop -InstanceId $folder.Name
  }
}
