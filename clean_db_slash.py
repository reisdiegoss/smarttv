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
        updated_count = 0
        for tv in tvs:
            if tv.guest_name and '/' in tv.guest_name:
                old_name = tv.guest_name
                new_name = old_name.split('/')[0].strip()
                tv.guest_name = new_name
                cust = dict(tv.custom_settings or {})
                cust["guest_name"] = new_name
                cust["welcome_title"] = f"Sr(a). {new_name}, Bem-vindo(a) ao Fasano"
                tv.custom_settings = cust
                updated_count += 1
                print(f"UH {tv.uh_number}: '{old_name}' -> '{new_name}'")

        if updated_count > 0:
            await session.commit()
            print(f"\\nSucesso: {updated_count} quartos atualizados removendo '/'.")
        else:
            print("Nenhum quarto com '/' encontrado.")

asyncio.run(main())
'''

sftp = client.open_sftp()
with sftp.file('/tmp/clean_db_slash.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command('/opt/smarttv/backend/venv/bin/python /tmp/clean_db_slash.py')
print(stdout.read().decode('utf-8'))
client.close()
