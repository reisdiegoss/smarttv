import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

HOST = "192.168.168.26"
PORT = 5432
USER = "postgres"
PASS = "6ffdd4a3d0e99d78b1e15f411b04e323"
DB = "smarttv"

try:
    print(f"Connecting to Postgres default DB (postgres) at {HOST}:{PORT}...")
    conn = psycopg2.connect(host=HOST, port=PORT, user=USER, password=PASS, dbname="postgres")
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB,))
    exists = cur.fetchone()
    if not exists:
        print(f"Database '{DB}' does not exist. Creating it now...")
        cur.execute(f'CREATE DATABASE "{DB}";')
        print(f"Database '{DB}' created successfully!")
    else:
        print(f"Database '{DB}' already exists.")
    cur.close()
    conn.close()

    print(f"Testing connection to target database '{DB}'...")
    conn_target = psycopg2.connect(host=HOST, port=PORT, user=USER, password=PASS, dbname=DB)
    cur_target = conn_target.cursor()
    cur_target.execute("SELECT version();")
    ver = cur_target.fetchone()
    print("PostgreSQL Version:", ver[0])
    cur_target.close()
    conn_target.close()
    print("SUCCESS: Connection to PostgreSQL verified!")
except Exception as e:
    print("ERROR:", e)
