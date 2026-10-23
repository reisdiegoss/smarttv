import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = '''
import sys
sys.path.insert(0, '/opt/smarttv/backend')
import asyncio
from app.core.database import AsyncSessionLocal
from app.models.schema import SmartTV
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(SmartTV))
        tvs = res.scalars().all()
        occupied = [tv for tv in tvs if tv.guest_name]
        vacant = [tv for tv in tvs if not tv.guest_name]
        print(f"=== TOTAL TVs: {len(tvs)} | OCUPADAS (COM HÓSPEDE): {len(occupied)} | VAGAS: {len(vacant)} ===")
        print("\\n--- EXEMPLOS DE QUARTOS COM HÓSPEDES ATIVOS ---")
        for tv in occupied[:20]:
            cust = tv.custom_settings or {}
            print(f"UH {tv.uh_number} ({tv.name}) -> Hóspede: '{tv.guest_name}' | Status: {cust.get('room_status')} | Grupo: {tv.room_group}")

asyncio.run(main())
'''

sftp = client.open_sftp()
with sftp.file('/tmp/check_db_guests.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('/opt/smarttv/backend/venv/bin/python /tmp/check_db_guests.py')
print(stdout.read().decode('utf-8'))
client.close()
