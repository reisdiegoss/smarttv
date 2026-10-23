import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = """
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5.0)
s.connect(('192.168.162.18', 5001))

da = time.strftime('%y%m%d')
ti = time.strftime('%H%M%S')

# 1. Send LinkStart
ls = f'\\x02<LinkStart Date="{da}" Time="{ti}"/>\\x03'.encode('latin1')
s.sendall(ls)
r1 = s.recv(1024)
print("1. Reply to LinkStart:", repr(r1))

# What happens if we just listen? Does the server send LinkDescription or something?
try:
    s.settimeout(2.0)
    extra = s.recv(1024)
    print("Extra data from server:", repr(extra))
except Exception as e:
    print("No extra data:", e)

# What if we send LinkDescription without Version or with Version="1.00"?
s.settimeout(5.0)
for test_xml in [
    f'<LinkDescription Date="{da}" Time="{ti}"/>',
    f'<LinkAlive Date="{da}" Time="{ti}"/>',
    f'<DatabaseResync Date="{da}" Time="{ti}"/>',
    f'<GuestCheckIn Request="All"/>'
]:
    pkt = f'\\x02{test_xml}\\x03'.encode('latin1')
    s.sendall(pkt)
    print("Sent:", test_xml)
    try:
        r = s.recv(1024)
        print("Reply:", repr(r))
        if b"LinkEnd" in r:
            print("Server sent LinkEnd, stopping.")
            break
    except Exception as e:
        print("Recv err:", e)

s.close()
"""

sftp = client.open_sftp()
with sftp.file('/tmp/test_5001_flow.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/test_5001_flow.py")
print("RESULT:\n", stdout.read().decode('utf-8'))
client.close()
