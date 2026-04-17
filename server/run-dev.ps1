# UNC-safe dev server start (does not rely on npm's cmd.exe shim).
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
node .\src\index.js
