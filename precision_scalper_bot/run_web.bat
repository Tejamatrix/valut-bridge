@echo off
title BulletScalp Pro - Web Trading Desk
cd /d "%~dp0"
echo Starting BulletScalp Web Server on http://127.0.0.1:8000 ...
python web_app.py
pause
