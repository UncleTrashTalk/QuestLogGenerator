@echo off
cd /d "%~dp0"
echo Qlover Quest Generator is available at http://127.0.0.1:8000
echo Keep this window open while using the app. Press Ctrl+C to stop the server.
echo.
python -m http.server 8000 --bind 127.0.0.1
pause
