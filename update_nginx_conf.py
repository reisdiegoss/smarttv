import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.168.27', username='root', password='@FasanoS#srv')

conf = """server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 1000M;

    # Frontend estático compilado
    root /opt/smarttv/frontend/dist;
    index index.html;

    # Download direto de APK com MIME type correto e Content-Disposition
    location ~* ^/(.+?\\.apk)$ {
        root /opt/smarttv/frontend/dist;
        types {
            application/vnd.android.package-archive apk;
        }
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="$1"';
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API REST
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # WebSockets para atualizações em tempo real
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
    }

    # Swagger Docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
    }
}
"""

sftp = client.open_sftp()
with sftp.open('/etc/nginx/sites-available/smarttv', 'w') as f:
    f.write(conf)
sftp.close()

_, stdout, stderr = client.exec_command('nginx -t && systemctl reload nginx')
print('Nginx test output:\n', stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err: print('Nginx stderr:\n', err)
client.close()
