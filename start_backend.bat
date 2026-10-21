@echo off
echo ========================================================
echo INICIANDO SERVIDOR BACKEND FASTAPI (PORTA 8000)
echo Conectado ao PostgreSQL: 192.168.168.26:5432 (smarttv)
echo ========================================================
cd /d %~dp0backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
