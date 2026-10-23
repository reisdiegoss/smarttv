import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

# First stop smarttv-backend temporarily so it doesn't hold the socket during the test
client.exec_command("systemctl stop smarttv-backend")

script = """
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(6.0)
s.connect(('192.168.162.18', 5020))
print("1. Socket connected to 5020")

# Wait for LS from IFC8
r_ls = s.recv(1024)
print("2. IFC8 sent:", repr(r_ls))

da = time.strftime('%y%m%d')
ti = time.strftime('%H%M%S')

def send(pkt_str):
    msg = f'\\x02{pkt_str}\\x03'.encode('latin1')
    print("SEND:", repr(msg))
    s.sendall(msg)

# Send LD
send(f'LD|DA{da}|TI{ti}|V#01.00|IFTV|')

# Send LR records defining requested transactions
send('LR|RIGI|FLRN|FLGN|FLGS|') # Guest In: Room, Guest Name, Guest Share/Title
send('LR|RIGO|FLRN|')           # Guest Out: Room
send('LR|RIGC|FLRN|FLGN|FLGS|') # Guest Change: Room, Guest Name
send('LR|RIDR|FLRN|')           # Database Resync
send('LR|RIDS|')                # Resync Start
send('LR|RIDE|')                # Resync End
send('LR|RILA|')                # Link Alive
send(f'LA|DA{da}|TI{ti}|')      # Link Alive heartbeat

# Read PMS response to handshake
try:
    s.settimeout(3.0)
    r_handshake = s.recv(2048)
    print("3. Handshake response from IFC8:", repr(r_handshake))
except Exception as e:
    print("3. Handshake read err:", e)

# Send Database Resync (DR) request!
send(f'DR|DA{da}|TI{ti}|')

# Listen for incoming records
for i in range(15):
    try:
        s.settimeout(4.0)
        rec = s.recv(4096)
        if not rec:
            print(f"Recv {i}: closed")
            break
        print(f"Recv {i}: {repr(rec)}")
        if b"DE" in rec or b"RE" in rec:
            print("Finished Resync!")
            break
    except socket.timeout:
        print(f"Recv {i}: timeout")
        break
    except Exception as e:
        print(f"Recv {i}: err {e}")
        break

s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_fias_lr.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/test_fias_lr.py")
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
print("RESULT:\n", out)
if err:
    print("STDERR:\n", err)

# Restart backend
client.exec_command("systemctl start smarttv-backend")
client.close()
