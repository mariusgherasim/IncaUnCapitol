@echo off
REM ============================================================
REM  IncaUnCapitol - actualizare zilnica JSON din feed-uri XML
REM  Pune acest fisier in folderul repo-ului (langa JSON-uri si
REM  sync-carti-feeds.cjs). Ruleaza-l cu dublu-click sau din
REM  Task Scheduler (vezi instaleaza-task-zilnic.bat).
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

REM ---------- SETARI ----------
REM Folderul cu feed-urile XML copiate local (relativ la repo)
set FEEDS=feeds
REM 1 = urca automat JSON-urile pe GitHub dupa actualizare, 0 = nu
set PUSH=1
REM Memorie pentru Node (MB) - feed-urile libris/libhumanitas sunt mari
set MEMORIE=6000
REM ----------------------------

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set AZI=%%i
if not exist logs mkdir logs
if not exist "%FEEDS%" mkdir "%FEEDS%"
set LOG=logs\sync-%AZI%.log

echo ================================================== >> "%LOG%"
echo  Start: %date% %time% >> "%LOG%"
echo ================================================== >> "%LOG%"

REM 1) Descarcare automata a feed-urilor (optional)
REM    Daca exista feed-urls.txt (linii: nume_fisier.xml URL), descarca fiecare feed.
REM    Daca nu exista, se folosesc feed-urile copiate manual in folderul %FEEDS%.
if exist feed-urls.txt (
  echo [1/3] Descarc feed-urile din feed-urls.txt >> "%LOG%"
  for /f "usebackq eol=# tokens=1,2" %%a in ("feed-urls.txt") do (
    curl -s -f -L --retry 3 -o "%FEEDS%\%%a.tmp" "%%b" && (
      move /y "%FEEDS%\%%a.tmp" "%FEEDS%\%%a" >nul
      echo    OK  %%a >> "%LOG%"
    ) || (
      del "%FEEDS%\%%a.tmp" 2>nul
      echo    EROARE la descarcare %%a - raman cu versiunea veche >> "%LOG%"
    )
  )
) else (
  echo [1/3] Fara feed-urls.txt - folosesc feed-urile copiate manual in %FEEDS% >> "%LOG%"
)

REM 2) Actualizare JSON
echo [2/3] Actualizez fisierele JSON >> "%LOG%"
node --max-old-space-size=%MEMORIE% sync-carti-feeds.cjs --feeds=%FEEDS% >> "%LOG%" 2>&1
if errorlevel 1 (
  echo EROARE: scriptul de sincronizare a esuat. Nimic urcat pe GitHub. >> "%LOG%"
  exit /b 1
)

REM 3) Urcare pe GitHub (doar daca s-a schimbat ceva)
if not "%PUSH%"=="1" (
  echo [3/3] PUSH=0 - nu urc nimic pe GitHub >> "%LOG%"
  goto final
)
echo [3/3] Urc modificarile pe GitHub >> "%LOG%"
git add carti-copii-1.json carti-copii-2.json carti-copii-3.json manuale-scolare.json manuale-scolare-2.json materii-suplimentare.json rechizite-papetarie.json articole-scolare-accesorii.json articole-scolare-jocuri.json oferte-carti-scolare.json carti-parenting.json muzica-film-1.json muzica-film-2.json books.json >> "%LOG%" 2>&1
git diff --cached --quiet
if not errorlevel 1 (
  echo    Nicio modificare - nimic de urcat >> "%LOG%"
  goto final
)
git commit -m "Actualizare zilnica feed-uri %AZI%" >> "%LOG%" 2>&1
git pull --rebase >> "%LOG%" 2>&1
git push >> "%LOG%" 2>&1
if errorlevel 1 (
  echo EROARE la git push - verifica logul >> "%LOG%"
  exit /b 1
)

:final
echo  Gata: %date% %time% >> "%LOG%"
REM sterge logurile mai vechi de 30 de zile
forfiles /p logs /m sync-*.log /d -30 /c "cmd /c del @path" 2>nul
exit /b 0
