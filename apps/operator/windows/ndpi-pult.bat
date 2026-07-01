@echo off
REM ============================================================
REM  NDPI - Pult operatora (Chrome app-mode, okno-vidzhet)
REM  Rabotaet na Windows 7 i Windows 10. WebView2/Tauri NE nuzhen.
REM  Esli adres boksa drugoy - pomenyay stroku "set BOX=..." nizhe.
REM ============================================================

set BOX=192.168.0.127

REM --- ishchem Chrome v standartnyh mestah ---
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo.
  echo  Google Chrome ne nayden. Ustanovite Chrome i zapustite snova.
  echo  Dlya Windows 7 - posledniaya versiya Chrome 109.
  echo.
  pause
  exit /b 1
)

REM --app  - chistoe okno bez vkladok i adresnoy stroki (kak vidzhet)
REM --user-data-dir - otdelnyy profil, ne meshaet obychnomu Chrome
start "" "%CHROME%" --app=http://%BOX%/operator --window-size=380,620 --user-data-dir="%LocalAppData%\ndpi-operator"
