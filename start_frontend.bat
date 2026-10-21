@echo off
echo ========================================================
echo INICIANDO PAINEL WEB DE GESTAO (PORTA 3000)
echo ========================================================
cd /d %~dp0frontend
npm run dev
pause
