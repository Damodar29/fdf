@echo off
rem Release APK (Android Studio se bani) ko USB se jude phone par install karo.
rem Ye sirf com.cpbs.bhajans.rntest ("Prem Bhakti RN") install karta hai —
rem asli Prem Bhakti app (com.cpbs.bhajans) ko haath nahi lagata.
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set APK=C:\rn\mobile\android\app\build\outputs\apk\release\app-release.apk
if not exist "%APK%" (
  echo Release APK nahi mili. Pehle Android Studio me release build banao.
  pause
  exit /b 1
)
"%ADB%" devices
"%ADB%" install -r "%APK%"
pause
