import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')
sftp = client.open_sftp()

files_to_sync = [
    ("backend/app/models/schema.py", "/opt/smarttv/backend/app/models/schema.py"),
    ("backend/app/models/dto.py", "/opt/smarttv/backend/app/models/dto.py"),
    ("backend/app/api/shortcuts.py", "/opt/smarttv/backend/app/api/shortcuts.py"),
    ("backend/app/api/tvs.py", "/opt/smarttv/backend/app/api/tvs.py"),
]

for local_path, remote_path in files_to_sync:
    print(f"Uploading {local_path} -> {remote_path}")
    sftp.put(local_path, remote_path)

sftp.close()

print("Restarting smarttv-backend service...")
stdin, stdout, stderr = client.exec_command("systemctl restart smarttv-backend && systemctl is-active smarttv-backend")
print("Status:", stdout.read().decode())
print("Error:", stderr.read().decode())

client.close()
