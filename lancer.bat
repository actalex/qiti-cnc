@echo off
REM Sert dist\ en local (Web Serial exige http://localhost) et ouvre la page
cd /d "%~dp0dist"
start "" "http://localhost:8000/atelier-cnc.html"
python -m http.server 8000
