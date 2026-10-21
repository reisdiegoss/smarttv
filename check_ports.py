import paramiko

HOSTNAME = "fassa27.fasanobr.local"
USER = "root"
PASS = "@FasanoS#srv"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=HOSTNAME, port=22, username=USER, password=PASS)

stdin, stdout, stderr = client.exec_command("ss -tulpn")
print("LISTENING PORTS:\n" + stdout.read().decode())
client.close()
