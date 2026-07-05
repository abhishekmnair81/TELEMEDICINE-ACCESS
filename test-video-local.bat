@echo off
echo ============================================
echo  Video Consultation Local Test Launcher
echo ============================================
echo.
echo Starting Chrome with FAKE camera (no real camera needed)...
echo.
echo Two tabs will open:
echo   Tab 1 - Login as Doctor ^> /doctor-video
echo   Tab 2 - Login as Patient ^> /video-consultation
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --use-fake-device-for-media-stream ^
  --use-fake-ui-for-media-stream ^
  --no-sandbox ^
  "http://localhost:3000/doctor-video" ^
  "http://localhost:3000"

echo Chrome launched! Open two tabs manually:
echo   http://localhost:3000/doctor-video   (login as doctor)
echo   http://localhost:3000               (login as patient)
echo.
pause
