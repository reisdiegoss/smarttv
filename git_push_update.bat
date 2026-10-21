@echo off
echo ========================================================
echo ENVIANDO ATUALIZACOES PARA O GITHUB (SMARTTV)
echo ========================================================
git add -A
set /p commit_msg="Digite a mensagem do commit (ou pressione Enter para padrao): "
if "%commit_msg%"=="" set commit_msg="update: sync changes"
git commit -m "%commit_msg%"
git push origin main

echo.
echo ========================================================
echo Enviado com sucesso para o GitHub!
echo Para aplicar a atualizacao no servidor, execute via SSH:
echo   smarttv-update
echo ========================================================
pause
