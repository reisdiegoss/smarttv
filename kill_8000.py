import os
import subprocess
import sys

print("--- Verificando processo na porta 8000 ---")
res = subprocess.run("netstat -ano | findstr :8000", shell=True, capture_output=True, text=True)
lines = [l.strip() for l in res.stdout.strip().split("\n") if l.strip()]
print(f"Linhas encontradas: {len(lines)}")
for l in lines:
    print("  ", l)
    if "LISTENING" in l:
        parts = l.split()
        pid = parts[-1]
        print(f"--> Encerrando PID {pid}...")
        k_res = subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True, text=True)
        print("    Resultado:", k_res.stdout.strip() or k_res.stderr.strip())

print("--- Concluido ---")
