@echo off
REM Works from UNC paths: pushd maps a temporary drive letter for the share.
pushd "%~dp0"
node src\index.js
set ERR=%ERRORLEVEL%
popd
exit /b %ERR%
