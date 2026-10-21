import subprocess
import sys

def run(cmd):
    print(">>", cmd)
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.stdout:
        print(r.stdout.strip())
    if r.stderr:
        print(r.stderr.strip())
    return r.returncode

print("=== ENVIANDO FIX DE DEPENDENCIAS E WORKFLOW ===")
run("git add -A")
run('git commit -m "fix(build): add media3-database dependency and direct gradle install without cache outage"')
code = run("git push origin main")
if code == 0:
    print("=== PUSH CONCLUIDO COM SUCESSO! ===")
else:
    print("=== FALHA NO PUSH ===")
