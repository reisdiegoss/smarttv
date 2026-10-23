import os
import sys
import paramiko

SERVER_IP = "192.168.168.27"
USER = "root"
PASS = "@FasanoS#srv"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
APK_PATH = os.path.join(BASE_DIR, "smarttv-launcher.apk")

print(f"--- Conectando ao Servidor {SERVER_IP} ---")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SERVER_IP, username=USER, password=PASS, timeout=12)
sftp = client.open_sftp()

print("\n--- 1. Enviando Frontend Dist ---")
remote_dist = "/opt/smarttv/frontend/dist"
client.exec_command(f"rm -rf {remote_dist}/assets/*")
client.exec_command(f"mkdir -p {remote_dist}/assets")

for root, dirs, files in os.walk(FRONTEND_DIST):
    rel_path = os.path.relpath(root, FRONTEND_DIST)
    rem_dir = os.path.join(remote_dist, rel_path).replace("\\", "/")
    client.exec_command(f"mkdir -p {rem_dir}")
    for f in files:
        loc_f = os.path.join(root, f)
        rem_f = os.path.join(rem_dir, f).replace("\\", "/")
        print(f"Deploying frontend file: {f}")
        sftp.put(loc_f, rem_f)

print("\n--- 2. Enviando APKs v1.0.7 ---")
if os.path.exists(APK_PATH):
    target_apks = [
        "/opt/smarttv/frontend/dist/smarttv-launcher.apk",
        "/opt/smarttv/frontend/dist/fasano-smarttv-v1.0.7.apk",
        "/opt/smarttv/frontend/dist/fasano-smarttv-latest.apk",
        "/opt/smarttv/frontend/public/smarttv-launcher.apk",
        "/opt/smarttv/frontend/public/fasano-smarttv-v1.0.7.apk",
        "/opt/smarttv/smarttv-launcher.apk"
    ]
    for target in target_apks:
        print(f"Copiando APK -> {target}")
        sftp.put(APK_PATH, target)

print("\n--- 3. Enviando Arquivos Backend ---")
backend_files = [
    ("backend/app/services/weather_service.py", "/opt/smarttv/backend/app/services/weather_service.py"),
    ("backend/app/services/fias_service.py", "/opt/smarttv/backend/app/services/fias_service.py"),
    ("backend/app/api/pms.py", "/opt/smarttv/backend/app/api/pms.py"),
    ("backend/app/api/tvs.py", "/opt/smarttv/backend/app/api/tvs.py"),
    ("backend/app/api/groups.py", "/opt/smarttv/backend/app/api/groups.py"),
    ("backend/app/models/schema.py", "/opt/smarttv/backend/app/models/schema.py"),
    ("backend/app/models/dto.py", "/opt/smarttv/backend/app/models/dto.py"),
    ("backend/requirements.txt", "/opt/smarttv/backend/requirements.txt")
]

for loc_rel, rem_path in backend_files:
    loc_full = os.path.join(BASE_DIR, loc_rel)
    print(f"Backend file: {loc_rel} -> {rem_path}")
    # ensure directory exists
    rem_dir = os.path.dirname(rem_path)
    client.exec_command(f"mkdir -p {rem_dir}")
    sftp.put(loc_full, rem_path)

sftp.close()

print("\n--- 4. Instalando openpyxl no venv do Servidor ---")
stdin, stdout, stderr = client.exec_command("/opt/smarttv/backend/venv/bin/pip install openpyxl")
stdout.channel.recv_exit_status()
print(stdout.read().decode('utf-8'))

print("\n--- 5. Reiniciando smarttv-backend e Nginx ---")
stdin, stdout, stderr = client.exec_command("systemctl restart smarttv-backend && systemctl status smarttv-backend --no-pager")
print("Status do serviço backend:\n", stdout.read().decode('utf-8', errors='replace').encode('ascii', errors='replace').decode('ascii'))
err = stderr.read().decode('utf-8', errors='replace')
if err:
    print("Erros stderr:\n", err.encode('ascii', errors='replace').decode('ascii'))

# Reload nginx
client.exec_command("systemctl reload nginx || systemctl restart nginx")

# Verify what index.html and assets contain
stdin, stdout, stderr = client.exec_command("grep -o 'v1.0.[0-9]' /opt/smarttv/frontend/dist/assets/*.js | head -n 10")
print("Verificação da versão no JS remoto:\n", stdout.read().decode('utf-8', errors='replace'))

client.close()
print("\n=== DEPLOY CONCLUÍDO COM SUCESSO! ===")
