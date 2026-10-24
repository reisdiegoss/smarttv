import subprocess
import logging
import asyncio
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

STREAMING_PACKAGES = [
    "com.google.android.youtube.tv",          # YouTube TV
    "com.netflix.ninja",                     # Netflix Android TV
    "com.amazon.amazonvideo.livingroom",     # Prime Video
    "com.spotify.tv.android",                # Spotify
    "com.disney.disneyplus",                 # Disney+
    "com.globo.globotv",                     # Globoplay
    "com.hbomax",                            # Max / HBO Max
    "com.wbd.stream",                        # Max novo
    "org.videolan.vlc"                       # VLC
]

def run_adb_command(args: List[str], timeout_sec: int = 10) -> Dict[str, Any]:
    """Executa um comando adb no servidor Linux"""
    cmd = ["adb"] + args
    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec
        )
        return {
            "success": res.returncode == 0,
            "stdout": res.stdout.strip(),
            "stderr": res.stderr.strip(),
            "returncode": res.returncode
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "stdout": "", "stderr": f"Timeout de {timeout_sec}s atingido", "returncode": -1}
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e), "returncode": -1}

class TVAdbManager:

    @staticmethod
    async def connect_tv(ip: str) -> Dict[str, Any]:
        """Conecta o ADB do servidor ao IP da TV na porta 5555"""
        if not ip:
            return {"status": "error", "message": "IP da TV não definido"}
        
        target = f"{ip}:5555"
        res = await asyncio.to_thread(run_adb_command, ["connect", target], 8)
        output = (res["stdout"] + " " + res["stderr"]).lower()

        # Checa status nos devices
        dev_res = await asyncio.to_thread(run_adb_command, ["devices"], 5)
        dev_out = dev_res["stdout"]

        if f"{target}\tdevice" in dev_out:
            return {"status": "connected", "message": f"TV {ip} conectada e autorizada via ADB!"}
        elif f"{target}\tunauthorized" in dev_out:
            return {
                "status": "unauthorized",
                "message": f"TV {ip} detectada, mas aguarda confirmação na tela da TV! Pressione 'OK' em 'Sempre permitir a depuração USB a partir deste computador'."
            }
        else:
            return {
                "status": "failed",
                "message": f"Não foi possível conectar em {target}. Verifique se a 'Opções de Desenvolvedor' e 'Depuração USB' estão ativas na TV.",
                "details": output
            }

    @staticmethod
    async def prepare_device_owner(ip: str) -> Dict[str, Any]:
        """
        Define o Fasano SMARTTV como Device Owner da TV via ADB.
        Isso permite que a TV limpe dados de qualquer app nativamente sem precisar de root.
        """
        conn = await TVAdbManager.connect_tv(ip)
        if conn["status"] != "connected":
            return conn

        target = f"{ip}:5555"
        cmd = ["-s", target, "shell", "dpm", "set-device-owner", "com.smarttv.launcher/.receiver.AdminReceiver"]
        res = await asyncio.to_thread(run_adb_command, cmd, 10)

        out = res["stdout"] + " " + res["stderr"]
        if "Success" in out or "success" in out.lower():
            return {
                "status": "success",
                "message": f"TV {ip} configurada com sucesso como Device Owner! A limpeza silenciosa de apps está totalmente desbloqueada."
            }
        elif "already set" in out.lower():
            return {
                "status": "success",
                "message": f"TV {ip} já está configurada como Device Owner!"
            }
        else:
            return {
                "status": "error",
                "message": f"Falha ao definir Device Owner na TV: {out}",
                "details": out
            }

    @staticmethod
    async def clear_tv_apps(ip: str, extra_packages: List[str] = None) -> Dict[str, Any]:
        """
        Executa 'pm clear' em todos os aplicativos de streaming da TV via ADB a partir do servidor.
        Limpa login do YouTube, Netflix, Prime Video, Disney+, etc.
        """
        conn = await TVAdbManager.connect_tv(ip)
        if conn["status"] != "connected":
            return conn

        target = f"{ip}:5555"
        packages = list(dict.fromkeys(STREAMING_PACKAGES + (extra_packages or [])))
        cleared = []
        failed = []

        for pkg in packages:
            if not pkg or pkg.startswith("action.") or "smarttv" in pkg:
                continue
            
            # Limpa dados do pacote
            res = await asyncio.to_thread(
                run_adb_command,
                ["-s", target, "shell", "pm", "clear", pkg],
                6
            )
            out = (res["stdout"] + " " + res["stderr"]).lower()
            
            # Força parada do app
            await asyncio.to_thread(
                run_adb_command,
                ["-s", target, "shell", "am", "force-stop", pkg],
                4
            )

            if "success" in out:
                cleared.append(pkg)
                logger.info(f"ADB clear success for {pkg} on {ip}")
            else:
                failed.append({"package": pkg, "reason": out.strip() or "not installed / error"})

        return {
            "status": "completed",
            "ip": ip,
            "cleared_count": len(cleared),
            "cleared_packages": cleared,
            "failed_packages": failed,
            "message": f"Limpeza concluída via ADB pelo Servidor! {len(cleared)} aplicativo(s) tiveram dados e contas apagados com sucesso."
        }

    @staticmethod
    async def setup_and_prepare_tv(ip: str) -> Dict[str, Any]:
        """
        Executa a rotina do técnico (Passo 5):
        Conecta ADB, verifica autorização na tela da TV e prepara a TV para comandos automáticos.
        """
        conn = await TVAdbManager.connect_tv(ip)
        if conn.get("status") == "unauthorized":
            return {
                "status": "unauthorized",
                "ip": ip,
                "message": "A TV recebeu a conexão, mas aguarda confirmação na tela! Olhe para a TV, marque 'Sempre permitir a partir deste computador' e clique em OK."
            }
        if conn.get("status") != "connected":
            return conn

        target = f"{ip}:5555"
        # Testa comando de eco
        test_res = await asyncio.to_thread(
            run_adb_command,
            ["-s", target, "shell", "echo", "READY"],
            5
        )
        if "READY" in test_res.get("stdout", ""):
            return {
                "status": "ready",
                "ip": ip,
                "message": f"TV {ip} conectada e autorizada com sucesso via ADB! Pronta para limpeza automática."
            }
        else:
            return {
                "status": "warning",
                "ip": ip,
                "message": f"TV conectada, mas resposta pendente: {test_res.get('stderr') or 'Aguardando confirmação na TV'}"
            }
