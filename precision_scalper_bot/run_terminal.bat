@echo off
title BulletScalp Pro - Live Terminal Desk
cd /d "%~dp0"
python main.py --symbol BTCUSDT --size 1000 --balance 10000 --tp 0.35 --sl 0.20
pause
