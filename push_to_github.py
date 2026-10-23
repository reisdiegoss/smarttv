import subprocess

def run(cmd):
    print(">>", cmd)
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.stdout:
        print(r.stdout.strip())
    if r.stderr:
        print(r.stderr.strip())
    return r.returncode

print("=== ENVIANDO ATUALIZACOES PMS / FIAS / DROPDOWN ===")
run("git add -A")
run('git commit -m "feat: fix FIAS handshake, parse guest names from IFC8 and add room dropdown selector"')
code = run("git push origin main")
if code == 0:
    print("=== PUSH CONCLUIDO COM SUCESSO! ===")
else:
    print("=== FALHA NO PUSH ===")
