import paramiko, json, time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

# Trigger Resync
stdin, stdout, stderr = client.exec_command('curl -s -X POST http://127.0.0.1:8000/api/pms/request-resync -H "Content-Type: application/json" -d "{}"')
print('RESYNC RESPONSE:', stdout.read().decode('utf-8'))

# Wait for IFC8 to send records
time.sleep(4)

stdin, stdout, stderr = client.exec_command('curl -s http://127.0.0.1:8000/api/pms/timeline')
data = json.loads(stdout.read().decode('utf-8'))
print('\nSTATUS:', data.get('status'))
print('\nEVENTOS DE RESYNC/HOSPEDES:')
for ev in data.get('timeline', []):
    cat = ev.get('category')
    if cat in ('GUEST', 'RESYNC'):
        print(f"[{ev.get('time_str')}] [{ev.get('category')}] {ev.get('title')} -> {ev.get('details')}")

client.close()
