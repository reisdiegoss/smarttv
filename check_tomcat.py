import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

script = """
import urllib.request, ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

paths = ["ifc", "ifc8", "ifccontroller", "ifc8controller", "opera", "fias", "manager", "OxiHub", "OperaWS", "ows_ws_51", "OperaS8", "ifcws"]
for p in paths:
    url = f"https://192.168.162.18/{p}/"
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, context=ctx, timeout=2.0)
        print(f"{p}: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"{p}: HTTP {e.code}")
    except Exception as e:
        print(f"{p}: {e}")
"""

sftp = client.open_sftp()
with sftp.file('/tmp/check_tomcat_apps.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = client.exec_command("python3 /tmp/check_tomcat_apps.py")
print("RESULT:\n", stdout.read().decode('utf-8'))
client.close()
