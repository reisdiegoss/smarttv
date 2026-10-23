import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = """
import socket

ports = [5001, 5010, 5020, 5060, 80, 443, 1521, 3389]
for p in ports:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    res = s.connect_ex(('192.168.162.18', p))
    status = "OPEN" if res == 0 else f"ERR {res}"
    print(f"Port {p}: {status}")
    s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/check_ifc8.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/check_ifc8.py")
print("RESULT:\n", stdout.read().decode('utf-8'))
client.close()
