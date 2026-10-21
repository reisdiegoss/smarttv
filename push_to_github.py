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

print("=== ENVIANDO FIX DE DESUGARING E COMPATIBILIDADE JAVA 1.8 ===")
run("git add -A")
run('git commit -m "fix(android): enable core library desugaring and Java 1.8 compatibility for minSdk 21"')
code = run("git push origin main")
if code == 0:
    print("=== PUSH CONCLUIDO COM SUCESSO! ===")
else:
    print("=== FALHA NO PUSH ===")
