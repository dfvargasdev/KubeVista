@echo off
REM Script to add Node.js to PATH and run commands

set NODE_HOME=C:\tools\node-v20.11.0-win-x64
set PATH=%NODE_HOME%;%PATH%

REM Run the command passed as argument
%*
