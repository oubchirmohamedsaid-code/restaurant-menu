@echo off
title Restaurant Menu - Reset Data
cd /d "%~dp0"
echo جارٍ إعادة زرع البيانات الأصلية (4 أصناف / 19 طبق)...
call npm run db:seed
echo.
echo تم. الآن شغّل start.bat لعرض المنيو.
pause
