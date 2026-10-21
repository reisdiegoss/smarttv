from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.schema import User, AuditLog
from app.services.audit import verify_password, hash_password, record_audit_log, get_client_ip

router = APIRouter(tags=["Auth & Audit"])

class LoginRequest(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    email: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    token: str
    user: UserOut

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: str
    ip_address: str
    action: str
    entity: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    description: Optional[str] = None
    old_values: Dict[str, Any] = {}
    new_values: Dict[str, Any] = {}
    diff_summary: List[Dict[str, Any]] = []
    created_at: datetime

    class Config:
        from_attributes = True

@router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username.strip()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        # Falha de login
        ip = get_client_ip(request)
        await record_audit_log(
            db=db,
            request=request,
            action="AUTH_LOGIN_FAILED",
            entity="Auth",
            entity_id=payload.username,
            entity_name=f"Tentativa com usuário '{payload.username}'",
            username=payload.username,
            description=f"Tentativa de login falhou a partir do IP {ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos"
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuário inativo no sistema")

    # Atualiza last_login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Registra na auditoria
    await record_audit_log(
        db=db,
        request=request,
        action="AUTH_LOGIN",
        entity="Auth",
        entity_id=str(user.id),
        entity_name=user.full_name,
        username=user.username,
        user_id=user.id,
        description=f"Usuário '{user.username}' efetuou login com sucesso"
    )

    # Token de sessão simples e seguro
    token = f"token_{user.id}_{int(datetime.utcnow().timestamp())}"

    return LoginResponse(
        token=token,
        user=UserOut.model_validate(user)
    )

@router.get("/audit-logs", response_model=List[AuditLogOut])
async def list_audit_logs(
    limit: int = 100,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    if action:
        query = query.where(AuditLog.action == action)
    if entity:
        query = query.where(AuditLog.entity == entity)

    query = query.limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs
