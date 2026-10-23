import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = """
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(6.0)
s.connect(('192.168.162.18', 5020))
print("Connected to 5020!")

# Step 1: Wait for LS from IFC8
r1 = s.recv(1024)
print("1. Received from IFC8:", repr(r1))

da = time.strftime('%y%m%d')
ti = time.strftime('%H%M%S')

# Step 2: Reply with LD (Link Description) and LA (Link Alive)
ld_pkt = f'\\x02LD|DA{da}|TI{ti}|V#01.00|IFTV|\\x03'.encode('latin1')
la_pkt = f'\\x02LA|DA{da}|TI{ti}|\\x03'.encode('latin1')

s.sendall(ld_pkt)
print("2. Sent LD:", ld_pkt)
time.sleep(0.1)

s.sendall(la_pkt)
print("3. Sent LA:", la_pkt)

# Step 3: Wait for reply from IFC8 (should be LA or LR)
try:
    r2 = s.recv(1024)
    print("4. Reply to LD/LA:", repr(r2))
except Exception as e:
    print("4. Err reading after LD/LA:", e)

# Step 4: Send Database Resync (DR)
dr_pkt = f'\\x02DR|DA{da}|TI{ti}|\\x03'.encode('latin1')
s.sendall(dr_pkt)
print("5. Sent DR:", dr_pkt)

# Step 5: Read incoming records (looking for DS, GI, DE)
for i in range(10):
    try:
        s.settimeout(3.0)
        rec = s.recv(2048)
        if not rec:
            print(f"Loop {i}: Connection closed by remote")
            break
        print(f"Loop {i}: RECV RECORD:", repr(rec))
        if b"DE" in rec or b"RE" in rec:
            print("Received Resync End (DE/RE)!")
            break
    except socket.timeout:
        print(f"Loop {i}: timeout (no more records)")
        break
    except Exception as e:
        print(f"Loop {i}: err:", e)
        break

s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_fias_full_flow.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/test_fias_full_flow.py")
print("RESULT:\n", stdout.read().decode('utf-8'))
client.close()
