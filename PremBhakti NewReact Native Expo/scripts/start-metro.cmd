@echo off
rem Debug build ke liye: Metro (JS server) chalao. Phone USB se juda ho to
rem "adb reverse" usse PC ke Metro tak pahunchata hai.
cd /d C:\rn\mobile
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
npx expo start --dev-client
