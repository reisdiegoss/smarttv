import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

client.exec_command("systemctl stop smarttv-backend")

script = """
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(6.0)
s.connect(('192.168.162.18', 5020))
r_ls = s.recv(1024)
print("1. LS received:", repr(r_ls))

da = time.strftime('%y%m%d')
ti = time.strftime('%H%M%S')

def send(pkt_str):
    msg = f'\\x02{pkt_str}\\x03'.encode('latin1')
    s.sendall(msg)

send(f'LD|DA{da}|TI{ti}|V#01.00|IFTV|')
send('LR|RIGI|FLRN|FLGN|FLGS|FLG#|')
send('LR|RIGO|FLRN|')
send('LR|RIGC|FLRN|FLGN|FLGS|')
send('LR|RIDR|FLRN|')
send('LR|RIDS|')
send('LR|RIDE|')
send('LR|RILA|')
send(f'LA|DA{da}|TI{ti}|')

# Send DR
send(f'DR|DA{da}|TI{ti}|')

print("2. Sent LR + DR. Now reading records...")
gi_count = 0
go_count = 0

buffer = bytearray()
start_time = time.time()
while time.time() - start_time < 8.0:
    try:
        s.settimeout(2.0)
        chunk = s.recv(2048)
        if not chunk:
            break
        buffer.extend(chunk)
        while b'\\x03' in buffer:
            idx_etx = buffer.index(b'\\x03')
            packet = buffer[:idx_etx]
            buffer = buffer[idx_etx + 1:]
            if b'\\x02' in packet:
                idx_stx = packet.index(b'\\x02')
                raw = packet[idx_stx + 1:].decode('latin1', errors='replace')
                cmd = raw.split('|')[0]
                if cmd == 'GI':
                    gi_count += 1
                    print(f"  [GI CHECK-IN] {raw}")
                elif cmd == 'GO':
                    go_count += 1
                elif cmd in ('DS', 'DE', 'RE', 'LA'):
                    print(f"  [{cmd}] {raw}")
    except socket.timeout:
        break
    except Exception as e:
        print("Recv err:", e)
        break

print(f"Summary: {gi_count} GI records, {go_count} GO records")
s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_fias_dump.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/test_fias_dump.py")
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
print("RESULT:\n", out)
if err: print("ERR:\n", err)

client.exec_command("systemctl start smarttv-backend")
client.close()
