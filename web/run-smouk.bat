@echo off
cd /d "%~dp0"
echo.
echo  Starting SKU... Keep this window OPEN while you use the site.
echo  When you see Ready, open:  http://127.0.0.1:3000
echo.
echo  If the page fails or port is busy:
echo    1. Close this window and other Node terminals
echo    2. Run:  npm run dev:clean
echo    3. Optional port 4567:  npm run dev:4567
echo.
call npm.cmd run dev
pause
