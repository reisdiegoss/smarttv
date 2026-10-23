import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = """
import socket, time

for p in [5001, 5010, 5020]:
    print(f"--- TESTING PORT {p} ---")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3.0)
    try:
        s.connect(('192.168.162.18', p))
        print(f"Port {p}: TCP connected")
        
        # Test 1: Just wait 2 seconds, does it stay connected or reset?
        time.sleep(1.0)
        
        # Test 2: Send standard FIAS Link Start
        da = time.strftime('%y%m%d')
        ti = time.strftime('%H%M%S')
        pkt = f'\\x02LS|DA{da}|TI{ti}|\\x03'.encode('latin1')
        s.sendall(pkt)
        print(f"Port {p}: Sent LS")
        
        try:
            resp = s.recv(1024)
            print(f"Port {p}: Recv -> {repr(resp)}")
        except Exception as e:
            print(f"Port {p}: Recv err -> {e}")
            
    except Exception as e:
        print(f"Port {p}: Connect err -> {e}")
    finally:
        s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_fias_ports_all.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/test_fias_ports_all.py")
print("RESULT:\n", stdout.read().decode('utf-8'))
client.close()
