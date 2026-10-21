import subprocess
import sys

def run_cmd(cmd):
    print(f">> {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout)
    if res.stderr:
        print(res.stderr, file=sys.stderr)
    return res.returncode

if __name__ == "__main__":
    print("--- Verificando status do Git ---")
    run_cmd("git status -s")
    
    print("\n--- Adicionando arquivos modificados ---")
    run_cmd("git add -A")
    
    print("\n--- Realizando commit ---")
    run_cmd('git commit -m "feat: implementacao de autenticacao com login, trilha de auditoria e comparativo antes/depois"')
    
    print("\n--- Enviando para o repositorio GitHub (git push) ---")
    code = run_cmd("git push origin main")
    if code == 0:
        print("\n=== PUSH REALIZADO COM SUCESSO! ===")
    else:
        print("\n=== FALHA NO PUSH OU NADA A ATUALIZAR ===")
