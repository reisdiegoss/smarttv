import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import select, update
from app.core.database import AsyncSessionLocal
from app.models.schema import SmartTV, DeviceLog

logger = logging.getLogger("FIASService")

class FIASService:
    def __init__(self, host: str = "192.168.162.18", port: int = 5020):
        self.host = host
        self.port = port
        self.is_running = False
        self.is_connected = False
        self.last_heartbeat: Optional[datetime] = None
        self.last_event: Optional[Dict[str, Any]] = None
        self.synced_events_count: int = 0
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info(f"FIAS Client iniciado para {self.host}:{self.port}")

    def stop(self):
        self.is_running = False
        if self._writer:
            try:
                self._writer.close()
            except Exception:
                pass
        if self._task:
            self._task.cancel()
            self._task = None
        self.is_connected = False
        logger.info("FIAS Client parado.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": self.is_running,
            "connected": self.is_connected,
            "host": self.host,
            "port": self.port,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_event": self.last_event,
            "synced_events_count": self.synced_events_count
        }

    async def _run_loop(self):
        while self.is_running:
            try:
                logger.info(f"Tentando conectar ao IFC8 em {self.host}:{self.port}...")
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=8.0
                )
                self.is_connected = True
                self.last_heartbeat = datetime.utcnow()
                logger.info(f"Conexão FIAS estabelecida com {self.host}:{self.port}!")

                # Processar stream contínuo de pacotes FIAS
                buffer = bytearray()
                while self.is_running:
                    # Ler bytes
                    chunk = await self._reader.read(1024)
                    if not chunk:
                        logger.warning("Conexão FIAS encerrada pelo IFC8 remoto.")
                        break

                    buffer.extend(chunk)
                    while b'\x03' in buffer:
                        idx_etx = buffer.index(b'\x03')
                        packet = buffer[:idx_etx]
                        buffer = buffer[idx_etx + 1:]

                        if b'\x02' in packet:
                            idx_stx = packet.index(b'\x02')
                            record_raw = packet[idx_stx + 1:].decode('latin1', errors='replace')
                            await self._handle_fias_record(record_raw)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Aviso FIAS ({self.host}:{self.port}): {e}. Reconectando em 15s...")
                self.is_connected = False
            finally:
                self.is_connected = False
                if self._writer:
                    try:
                        self._writer.close()
                        await self._writer.wait_closed()
                    except Exception:
                        pass
                    self._writer = None
                    self._reader = None

            if self.is_running:
                await asyncio.sleep(15)

    async def _send_packet(self, text: str):
        if self._writer:
            try:
                payload = f"\x02{text}\x03".encode('latin1')
                self._writer.write(payload)
                await self._writer.drain()
            except Exception as e:
                logger.error(f"Erro ao enviar pacote FIAS: {e}")

    async def _handle_fias_record(self, record: str):
        now = datetime.now()
        da = now.strftime("%y%m%d")
        ti = now.strftime("%H%M%S")

        parts = record.split('|')
        if not parts:
            return

        cmd = parts[0]
        fields = {}
        for p in parts[1:]:
            if len(p) >= 2:
                key = p[:2]
                val = p[2:]
                fields[key] = val

        self.last_heartbeat = datetime.utcnow()

        if cmd == "LS":
            # Link Start do IFC8 -> Respondemos com Link Description (LD) ou Link Alive (LA)
            logger.info("FIAS: Link Start (LS) recebido. Respondendo com LD e LA...")
            await self._send_packet(f"LD|DA{da}|TI{ti}|V#01.00|IFTV|")
            await self._send_packet(f"LA|DA{da}|TI{ti}|")

        elif cmd == "LA":
            # Link Alive periódico
            await self._send_packet(f"LA|DA{da}|TI{ti}|")

        elif cmd == "GI":
            # Guest Check-In
            rn = fields.get("RN") # Room Number / UH
            gs = fields.get("GS", "").strip() # Sobrenome
            gn = fields.get("GN", "").strip() # Nome
            guest_name = f"{gn} {gs}".strip() or gs
            logger.info(f"FIAS CHECK-IN: Quarto {rn} -> Hóspede: {guest_name}")
            self.last_event = {"type": "CHECK_IN", "uh": rn, "guest_name": guest_name, "time": datetime.utcnow().isoformat()}
            self.synced_events_count += 1
            if rn:
                await self._sync_tv_guest(rn, guest_name, is_checkin=True)

        elif cmd == "GO":
            # Guest Check-Out
            rn = fields.get("RN")
            logger.info(f"FIAS CHECK-OUT: Quarto {rn}")
            self.last_event = {"type": "CHECK_OUT", "uh": rn, "time": datetime.utcnow().isoformat()}
            self.synced_events_count += 1
            if rn:
                await self._sync_tv_guest(rn, None, is_checkin=False)

        elif cmd == "GC":
            # Guest Change
            rn = fields.get("RN")
            gs = fields.get("GS", "").strip()
            gn = fields.get("GN", "").strip()
            guest_name = f"{gn} {gs}".strip() or gs
            logger.info(f"FIAS GUEST CHANGE: Quarto {rn} -> {guest_name}")
            self.last_event = {"type": "GUEST_CHANGE", "uh": rn, "guest_name": guest_name, "time": datetime.utcnow().isoformat()}
            self.synced_events_count += 1
            if rn:
                await self._sync_tv_guest(rn, guest_name, is_checkin=True)

    async def _sync_tv_guest(self, uh: str, guest_name: Optional[str], is_checkin: bool):
        clean_uh = str(uh).strip()
        async with AsyncSessionLocal() as session:
            try:
                # Localizar TV pela UH ou Nome
                result = await session.execute(select(SmartTV))
                tvs = result.scalars().all()
                target_tv = None
                for tv in tvs:
                    if tv.uh_number and tv.uh_number.strip().lower() == clean_uh.lower():
                        target_tv = tv
                        break
                    cust = tv.custom_settings or {}
                    if str(cust.get("uh_number") or "").strip().lower() == clean_uh.lower():
                        target_tv = tv
                        break
                    if clean_uh.lower() in tv.name.lower():
                        target_tv = tv
                        break

                if target_tv:
                    target_tv.uh_number = clean_uh
                    target_tv.guest_name = guest_name if is_checkin else None

                    cust = dict(target_tv.custom_settings or {})
                    cust["uh_number"] = clean_uh
                    if is_checkin and guest_name:
                        cust["guest_name"] = guest_name
                        cust["welcome_title"] = f"Sr(a). {guest_name}, Bem-vindo(a) ao Fasano"
                    else:
                        cust.pop("guest_name", None)
                        cust["welcome_title"] = "Seja Bem-vindo(a) ao Fasano"

                    target_tv.custom_settings = cust
                    target_tv.updated_at = datetime.utcnow()

                    action_name = "CHECK_IN" if is_checkin else "CHECK_OUT"
                    log_msg = f"FIAS IFC8 ({action_name}): UH {clean_uh} vinculada a '{guest_name or 'Check-out'}'"
                    log = DeviceLog(tv_id=target_tv.id, event_type=f"PMS_{action_name}", message=log_msg)
                    session.add(log)

                    await session.commit()
                    logger.info(f"TV ID {target_tv.id} ({target_tv.name}) sincronizada com sucesso via FIAS!")
            except Exception as e:
                logger.error(f"Erro ao salvar hóspede FIAS na TV: {e}")

fias_service = FIASService()
