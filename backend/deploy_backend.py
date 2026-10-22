import paramiko
import os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv', timeout=10)
sftp = client.open_sftp()

files_to_sync = [
    ("backend/app/models/dto.py", "/opt/smarttv/backend/app/models/dto.py"),
    ("backend/app/api/tvs.py", "/opt/smarttv/backend/app/api/tvs.py"),
    ("backend/app/api/media.py", "/opt/smarttv/backend/app/api/media.py"),
    ("backend/app/api/layouts.py", "/opt/smarttv/backend/app/api/layouts.py"),
    ("backend/app/core/config.py", "/opt/smarttv/backend/app/core/config.py"),
]

for local, remote in files_to_sync:
    print(f"Enviando {local} -> {remote}...")
    sftp.put(local, remote)

sftp.close()

stdin, stdout, stderr = client.exec_command("systemctl restart smarttv-backend && systemctl status smarttv-backend --no-pager")
print("Status do serviço:\n", stdout.read().decode('utf-8'))
print("Erros (se houver):\n", stderr.read().decode('utf-8'))
client.close()
print("Backend sincronizado e reiniciado com sucesso!")
