@echo off
title Photo Mosaic System - Cloudflare Tunnel

cd /d "%~dp0"

echo ==================================================
echo   Starting Photo Mosaic System + Cloudflare Tunnel
echo   (Both server logs and Cloudflare Tunnel URLs 
echo    will automatically appear in this window!)
echo ==================================================
echo.

node src/server.js

echo.
echo [ERROR] The server has crashed or stopped!
echo Please check the error messages above.
pause
