@echo off
title Restaurant Menu - Deyaa
cd /d "%~dp0"
echo.
echo ========================================
echo   مطعم الذواقة - تشغيل المنيو
echo ========================================
echo.
echo جارٍ تشغيل الخادم... سيُفتح المتصفح تلقائياً
echo بعد لحظات. لا تغلق هذه النافذة.
echo.
start "" cmd /c "timeout /t 20 /nobreak >nul && start http://localhost:3000"
npm run dev
