import paramiko, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

client.exec_command('systemctl stop smarttv-backend')
time.sleep(8)

script = """
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(12.0)
s.connect(('192.168.162.18', 5020))

def send_pkt(p):
    s.sendall(f'\\x02{p}\\x03'.encode('latin1'))

def read_pkt():
    buf = bytearray()
    while True:
        c = s.recv(1)
        if not c: return None
        if c == b'\\x02':
            buf = bytearray()
        elif c == b'\\x03':
            return buf.decode('latin1', errors='replace')
        else:
            buf.extend(c)

ls = read_pkt()
print('LS from IFC8:', ls)

da = time.strftime('%y%m%d')
ti = time.strftime('%H%M%S')

send_pkt(f'LD|DA{da}|TI{ti}|V#01.00|IFTV|')
send_pkt('LR|RIGI|FLRNGNG#GSGL|')
send_pkt('LR|RIGO|FLRN|')
send_pkt('LR|RIGC|FLRNGNG#GSGL|')
send_pkt('LR|RIDR|FLRN|')
send_pkt('LR|RIDS|')
send_pkt('LR|RIDE|')
send_pkt('LR|RILA|')
send_pkt(f'LA|DA{da}|TI{ti}|')

time.sleep(0.5)

send_pkt(f'DR|DA{da}|TI{ti}|')
print('Sent DR!')

all_pkts = []
t0 = time.time()
while time.time() - t0 < 30.0:
    try:
        s.settimeout(4.0)
        p = read_pkt()
        if not p:
            print('EOF received from IFC8')
            break
        all_pkts.append(p)
        if p.startswith('LA'):
            now_ti = time.strftime('%H%M%S')
            send_pkt(f'LA|DA{da}|TI{now_ti}|')
            print('Replied to LA')
        elif p.startswith('GI'):
            print('>> GI:', p)
        elif p.startswith('GO'):
            pass
        elif p.startswith('DE') or p.startswith('RE'):
            print('>> END OF RESYNC:', p)
            break
        else:
            print('>> OTHER:', p)
    except socket.timeout:
        print('Timeout waiting for next packet.')
        break
    except Exception as e:
        print('Error:', e)
        break

s.close()

gi_pkts = [p for p in all_pkts if p.startswith('GI')]
go_pkts = [p for p in all_pkts if p.startswith('GO')]
print(f'Done. Total packets: {len(all_pkts)} | GI: {len(gi_pkts)} | GO: {len(go_pkts)}')
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_dr_la.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('python3 /tmp/test_dr_la.py')
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err: print('ERR:', err)

client.exec_command('systemctl start smarttv-backend')
client.close()
