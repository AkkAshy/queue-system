@echo off
REM ── NDPI queue kiosk agent — kiosk-host mode (UI + print + Chrome/Edge) ──
REM Просто дважды кликни этот файл. Откроется браузер-киоск.
REM Имя принтера ниже — как в Windows (Параметры → Принтеры).

cd /d "%~dp0"

set AGENT_BACKEND=windows
set AGENT_PRINTER_NAME=XP-80C
set AGENT_ADDR=127.0.0.1:8089
set AGENT_UPSTREAM=https://nmpi.avtoxizmet.uz
set AGENT_KIOSK=1
set AGENT_LOG_FILE=%~dp0agent.log

echo Запуск агента киоска... сейчас откроется браузер.
echo (это окно можно свернуть; закроешь - агент остановится)
echo.

ndpi-agent.exe

echo.
echo ==========================================================
echo  Агент ОСТАНОВИЛСЯ. Строка(и) выше - причина.
echo  Окно оставлено специально, чтобы ошибка не исчезла.
echo ==========================================================
pause
