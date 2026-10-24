import os
import sys
import paramiko
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Identifica versão atual
app_version = "1.0.9"
gradle_file = os.path.join(BASE_DIR, "android-tv-app", "app", "build.gradle.kts")
if os.path.exists(gradle_file):
    with open(gradle_file, "r", encoding="utf-8") as gf:
        m = re.search(r'versionName\s*=\s*"([^"]+)"', gf.read())
        if m:
            app_version = m.group(1)

APK_FILENAMES = [
    "smarttv-launcher.apk",
    "fasano-smarttv-latest.apk",
    f"fasano-smarttv-v{app_version}.apk"
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Conectando a 192.168.168.27...")
    ssh.connect("192.168.168.27", username="root", password="@FasanoS#srv", timeout=10)
    sftp = ssh.open_sftp()

    # 1. Upload do arquivo shortcuts.py atualizado
    backend_shortcuts = os.path.join(BASE_DIR, "backend", "app", "api", "shortcuts.py")
    if os.path.exists(backend_shortcuts):
        print("Enviando backend shortcuts.py atualizado...")
        sftp.put(backend_shortcuts, "/opt/smarttv/backend/app/api/shortcuts.py")
        print("[OK] shortcuts.py enviado para o backend")

    # 2. Garante pastas
    stdin, stdout, stderr = ssh.exec_command("mkdir -p /opt/smarttv/frontend/dist /opt/smarttv/frontend/public")
    stdout.channel.recv_exit_status()

    # 3. Upload dos APKs
    for apk_name in APK_FILENAMES:
        local_path = os.path.join(BASE_DIR, apk_name)
        if not os.path.exists(local_path):
            # fallback para smarttv-launcher.apk se o versionado não existir
            local_path = os.path.join(BASE_DIR, "smarttv-launcher.apk")

        if os.path.exists(local_path):
            print(f"Enviando {apk_name} ({os.path.getsize(local_path)/(1024*1024):.2f} MB)...")
            sftp.put(local_path, f"/opt/smarttv/frontend/dist/{apk_name}")
            sftp.put(local_path, f"/opt/smarttv/frontend/public/{apk_name}")
            sftp.put(local_path, f"/opt/smarttv/{apk_name}")

    sftp.close()

    # 4. Atualiza banco de dados: inclui shortcuts 7 e 8 nos grupos e TVs que tinham [1..6]
    # e atualiza timestamp de TV 174 e Group 2
    sync_db_cmd = '''cd /opt/smarttv/backend && /opt/smarttv/backend/venv/bin/python3 -c "
import asyncio
from datetime import datetime
from app.core.database import AsyncSessionLocal
from app.models.schema import SmartTV, TVGroup, AppShortcut
from sqlalchemy import select, update

async def main():
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        # Atalhos disponíveis
        scs = (await db.execute(select(AppShortcut).order_by(AppShortcut.default_order.asc()))).scalars().all()
        all_ids = [s.id for s in scs]
        print('All shortcut IDs:', all_ids)
        
        # Atualiza grupos
        groups = (await db.execute(select(TVGroup))).scalars().all()
        for g in groups:
            g.selected_shortcuts = all_ids
            g.updated_at = now
            print(f'Group {g.id} ({g.name}) updated shortcuts: {g.selected_shortcuts}')

        # Atualiza TVs
        tvs = (await db.execute(select(SmartTV))).scalars().all()
        for t in tvs:
            if t.selected_shortcuts:
                t.selected_shortcuts = all_ids
            t.updated_at = now
            print(f'TV {t.id} ({t.device_id}, UH {t.uh_number}) updated shortcuts: {t.selected_shortcuts}')

        await db.commit()
        print('DB sync complete!')

asyncio.run(main())
"'''
    stdin, stdout, stderr = ssh.exec_command(sync_db_cmd)
    print("Resultado sync DB:\n", stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print("ERR sync DB:", err)

    # 5. Reinicia serviço backend uvicorn
    stdin, stdout, stderr = ssh.exec_command("systemctl restart smarttv-backend || pkill -f 'uvicorn app.main:app'")
    stdout.channel.recv_exit_status()
    print("Backend reiniciado!")

    # 6. Verifica arquivos
    stdin, stdout, stderr = ssh.exec_command("ls -lh /opt/smarttv/frontend/dist/*.apk")
    print("APKs no servidor:\n", stdout.read().decode())

    print("\n[SUCESSO COMPLETO] Deploy finalizado no servidor 192.168.168.27!")

except Exception as e:
    print(f"Erro no deploy: {e}")
finally:
    ssh.close()
