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

    async def request_database_resync(self, room_number: Optional[str] = None) -> bool:
        """Envia solicitação de Database Resync (DR) ao IFC8/Opera para obter todas as UHs e hóspedes ativos"""
        if not self.is_connected or not self._writer:
            logger.warning("Não é possível solicitar Database Resync: socket FIAS não está conectado.")
            return False
        
        now = datetime.now()
        da = now.strftime("%y%m%d")
        ti = now.strftime("%H%M%S")
        if room_number:
            packet = f"DR|DA{da}|TI{ti}|RN{room_number.strip()}|"
        else:
            packet = f"DR|DA{da}|TI{ti}|"

        await self._send_packet(packet)
        self.last_event = {
            "type": "RESYNC_REQUESTED",
            "uh": room_number or "ALL",
            "time": datetime.utcnow().isoformat()
        }
        logger.info(f"FIAS: Pacote Database Resync enviado ao IFC8: {packet}")
        return True

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
            # Guest Check-In ou retorno de Resync (DR) com hóspede ativo
            rn = fields.get("RN") # Room Number / UH
            gs = fields.get("GS", "").strip() # Sobrenome
            gn = fields.get("GN", "").strip() # Nome
            guest_name = f"{gn} {gs}".strip() or gs
            logger.info(f"FIAS CHECK-IN / RESYNC: Quarto {rn} -> Hóspede: {guest_name}")
            self.last_event = {"type": "CHECK_IN", "uh": rn, "guest_name": guest_name, "time": datetime.utcnow().isoformat()}
            self.synced_events_count += 1
            if rn:
                await self._sync_tv_guest(rn, guest_name, is_checkin=True, fields=fields)

        elif cmd == "GO":
            # Guest Check-Out
            rn = fields.get("RN")
            logger.info(f"FIAS CHECK-OUT: Quarto {rn}")
            self.last_event = {"type": "CHECK_OUT", "uh": rn, "time": datetime.utcnow().isoformat()}
            self.synced_events_count += 1
            if rn:
                await self._sync_tv_guest(rn, None, is_checkin=False, fields=fields)

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
                await self._sync_tv_guest(rn, guest_name, is_checkin=True, fields=fields)

        elif cmd == "RE":
            # Resync End (Carga completa concluída pelo Opera)
            logger.info("FIAS RESYNC END (RE): Carga inicial completa do Opera finalizada com sucesso.")
            self.last_event = {"type": "RESYNC_END", "time": datetime.utcnow().isoformat()}

        elif cmd in ("WR", "RS"):
            # Room Status (UH limpa, suja, etc.)
            rn = fields.get("RN")
            rs = fields.get("RS", "")
            logger.info(f"FIAS ROOM STATUS: Quarto {rn} -> Status: {rs}")
            self.last_event = {"type": "ROOM_STATUS", "uh": rn, "status": rs, "time": datetime.utcnow().isoformat()}

    async def _sync_tv_guest(self, uh: str, guest_name: Optional[str], is_checkin: bool, fields: Optional[Dict[str, str]] = None):
        clean_uh = str(uh).strip()
        if not clean_uh:
            return

        from app.models.schema import TVGroup

        async with AsyncSessionLocal() as session:
            try:
                # 1. Localizar TV existente pela UH ou Nome
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
                    # Se TV tiver pms_enabled=False (ex: Reunião, Diretoria, Setor), o Opera PMS NUNCA sobrescreve suas mensagens!
                    if not getattr(target_tv, 'pms_enabled', True):
                        logger.info(f"TV '{target_tv.name}' (UH {clean_uh}) possui pms_enabled=False (Institucional / Manual). PMS Opera ignorado.")
                        return

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
                else:
                    # Se a TV NÃO existe no banco, criamos automaticamente para que a equipe técnica possa parear o APK!
                    group_res = await session.execute(
                        select(TVGroup).where(TVGroup.name.ilike("%Quartos%")).order_by(TVGroup.id.asc())
                    )
                    default_group = group_res.scalars().first()
                    if not default_group:
                        first_grp = await session.execute(select(TVGroup).order_by(TVGroup.id.asc()))
                        default_group = first_grp.scalars().first()

                    clean_code = f"UH-{clean_uh.zfill(4)}"
                    new_settings = {
                        "uh_number": clean_uh,
                        "welcome_title": f"Sr(a). {guest_name}, Bem-vindo(a) ao Fasano" if (is_checkin and guest_name) else "Seja Bem-vindo(a) ao Fasano",
                        "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
                        "pin_code": "0000"
                    }
                    if is_checkin and guest_name:
                        new_settings["guest_name"] = guest_name

                    new_tv = SmartTV(
                        device_id=f"UH-{clean_uh}",
                        name=f"Quarto {clean_uh}",
                        room_group=default_group.name if default_group else "TV Quartos",
                        group_id=default_group.id if default_group else None,
                        uh_number=clean_uh,
                        guest_name=guest_name if is_checkin else None,
                        pms_enabled=True,
                        pin_code="0000",
                        pairing_code=clean_code,
                        is_paired=False,
                        is_online=False,
                        custom_settings=new_settings
                    )
                    session.add(new_tv)
                    await session.flush()

                    log = DeviceLog(
                        tv_id=new_tv.id,
                        event_type="PMS_AUTO_CREATE_UH",
                        message=f"TV criada automaticamente a partir de evento do Opera: UH {clean_uh} ('{guest_name or 'Quarto Vago'}')"
                    )
                    session.add(log)
                    await session.commit()
                    logger.info(f"Nova TV para UH {clean_uh} criada com sucesso pelo FIAS! ID: {new_tv.id}")

            except Exception as e:
                logger.error(f"Erro ao salvar hóspede FIAS na TV: {e}")

fias_service = FIASService()
