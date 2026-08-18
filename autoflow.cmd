@echo off
chcp 65001 > NUL
set FORCE_COLOR=1
set ELECTRON_RUN_AS_NODE=1
set AUTOFLOW_PACKAGED=true
"%~dp0Autoflow-vNext.exe" "%~dp0resources\app.asar\dist\cli.js" %*
