@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0build-local-images.ps1" %*
