import paramiko
import os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv', timeout=10)
sftp = client.open_sftp()

local_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
remote_dist = "/opt/smarttv/frontend/dist"

client.exec_command(f"mkdir -p {remote_dist}/assets")

for root, dirs, files in os.walk(local_dist):
    rel_path = os.path.relpath(root, local_dist)
    rem_dir = os.path.join(remote_dist, rel_path).replace("\\", "/")
    client.exec_command(f"mkdir -p {rem_dir}")
    for f in files:
        if f.endswith(".apk"): continue
        loc_f = os.path.join(root, f)
        rem_f = os.path.join(rem_dir, f).replace("\\", "/")
        sftp.put(loc_f, rem_f)

sftp.close()
client.close()
print("Frontend dist enviado ao servidor com sucesso!")
