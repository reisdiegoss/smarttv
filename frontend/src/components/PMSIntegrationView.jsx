import React, { useState, useEffect } from 'react';
import { 
  Building2, Activity, Wifi, CheckCircle2, AlertCircle, RefreshCw, 
  Send, User, Key, Tv, ShieldCheck, ArrowRight, Clock, Server
} from 'lucide-react';

export default function PMSIntegrationView({ tvs = [], onRefresh, fetchHeaders }) {
  const [pmsStatus, setPmsStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Form states
  const [uhNumber, setUhNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [actionType, setActionType] = useState('CHECK_IN');
  const [welcomeTitle, setWelcomeTitle] = useState('');

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/pms/status', {
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPmsStatus(data);
      }
    } catch (e) {
      console.error('Erro ao carregar status PMS:', e);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/pms/test-connection', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      const data = await res.json();
      setTestResult(data);
      loadStatus();
    } catch (e) {
      setTestResult({
        status: 'error',
        message: `Falha na requisição: ${e.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncUH = async (e) => {
    e.preventDefault();
    if (!uhNumber.trim()) {
      alert('Informe o número da UH (Quarto).');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/pms/sync-uh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          uh_number: uhNumber.trim(),
          guest_name: actionType === 'CHECK_IN' ? guestName.trim() : null,
          welcome_title: welcomeTitle.trim() || undefined,
          action: actionType
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao sincronizar UH');
      }

      const data = await res.json();
      alert(`Sucesso: ${data.message}`);
      setUhNumber('');
      setGuestName('');
      setWelcomeTitle('');
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickCheckout = async (uh) => {
    if (!window.confirm(`Confirma o Check-out da UH ${uh}? O nome do hóspede será removido e o título padrão restaurado na TV.`)) {
      return;
    }
    try {
      const res = await fetch('/api/pms/sync-uh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          uh_number: String(uh),
          action: 'CHECK_OUT'
        })
      });
      if (!res.ok) throw new Error('Falha ao realizar check-out');
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (e) {
      alert(`Erro: ${e.message}`);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color="var(--primary)" />
            Integração Hospitality PMS (IFC8 / FIAS)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Conexão com servidor IFC8 em 192.168.162.18 (Thexpos, Vingcard, Leucotron). Sincronização em tempo real de UH e Hóspede.
          </p>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={loadStatus}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={15} /> Atualizar Status
        </button>
      </div>

      {/* Grid de Cartões de Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Cartão 1: Servidor IFC8 */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Servidor de Integração
              </span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.75rem',
                fontWeight: 600,
                background: pmsStatus?.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: pmsStatus?.connected ? '#10b981' : '#ef4444'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: pmsStatus?.connected ? '#10b981' : '#ef4444' }} />
                {pmsStatus?.connected ? 'SOCKET CONECTADO' : 'AGUARDANDO'}
              </div>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="var(--primary)" />
              {pmsStatus?.host || '192.168.162.18'}:{pmsStatus?.port || 5020}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Protocolo Oracle FIAS Pipe (Porta 5020) com handshake automático.
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <Activity size={14} /> {testingConnection ? 'Testando Conexão...' : 'Testar Conexão Socket Agora'}
            </button>
          </div>
        </div>

        {/* Cartão 2: Sistemas Integrados */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Serviços Conectados ao IFC8
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Thexpos (PMS / Hotelaria)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Vingcard (Fechaduras Eletrônicas)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Leucotron (Telefonia / Tarifação)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Smart TV Launcher (Launcher Fasano)</span>
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <ShieldCheck size={13} /> Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Cartão 3: Métricas de Eventos */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Último Evento Recebido
          </span>

          <div style={{ marginTop: 12 }}>
            {pmsStatus?.last_event ? (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4 }}>
                  {pmsStatus.last_event.type === 'CHECK_IN' && '🏨 Check-In Realizado'}
                  {pmsStatus.last_event.type === 'CHECK_OUT' && '🚪 Check-Out Realizado'}
                  {pmsStatus.last_event.type === 'GUEST_CHANGE' && '✏️ Alteração de Hóspede'}
                </div>
                <div style={{ color: 'var(--text-main)' }}>
                  UH: <strong>{pmsStatus.last_event.uh}</strong> 
                  {pmsStatus.last_event.guest_name && ` | Hóspede: ${pmsStatus.last_event.guest_name}`}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '12px 0' }}>
                Ouvinte ativo aguardando eventos do IFC8...
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Sincronizados:</span>
              <strong style={{ color: 'var(--text-main)' }}>{pmsStatus?.synced_events_count || 0} eventos</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado do Teste de Conexão */}
      {testResult && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 10,
          background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${testResult.status === 'success' ? '#10b981' : '#ef4444'}`,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {testResult.status === 'success' ? <CheckCircle2 color="#10b981" size={18} /> : <AlertCircle color="#ef4444" size={18} />}
          <div>
            <span style={{ fontWeight: 600, color: testResult.status === 'success' ? '#10b981' : '#ef4444' }}>
              {testResult.message}
            </span>
            {testResult.banner && (
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2, fontFamily: 'monospace' }}>
                Banner retornado: {testResult.banner}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulário de Sincronização Manual / Teste de UH */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid var(--border-color)',
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={18} color="var(--primary)" />
          Sincronização / Atualização Rápida de Hóspede na UH
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Utilize esta ferramenta para vincular um hóspede a uma UH diretamente ou para testar o comportamento da Launcher da TV.
        </p>

        <form onSubmit={handleSyncUH} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="form-label">Número da UH (Quarto) *</label>
            <input 
              type="text" 
              className="form-control" 
              value={uhNumber} 
              onChange={e => setUhNumber(e.target.value)} 
              placeholder="Ex: 101 ou TI"
              required
            />
          </div>

          <div>
            <label className="form-label">Tipo de Ação</label>
            <select 
              className="form-control"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
            >
              <option value="CHECK_IN">Check-In / Atualizar Hóspede</option>
              <option value="CHECK_OUT">Check-Out (Liberar Quarto)</option>
            </select>
          </div>

          {actionType === 'CHECK_IN' && (
            <div>
              <label className="form-label">Nome do Hóspede</label>
              <input 
                type="text" 
                className="form-control" 
                value={guestName} 
                onChange={e => setGuestName(e.target.value)} 
                placeholder="Ex: Diego Reis"
              />
            </div>
          )}

          <div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={syncing}
              style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Send size={15} /> {syncing ? 'Sincronizando...' : 'Enviar para TV'}
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de UHs e TVs Cadastradas */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tv size={18} color="var(--primary)" />
          Status das UHs e Hóspedes Vinculados às TVs ({tvs.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>UH / Quarto</th>
                <th style={{ padding: '10px 12px' }}>Nome da TV</th>
                <th style={{ padding: '10px 12px' }}>Grupo / Perfil</th>
                <th style={{ padding: '10px 12px' }}>Hóspede Atual</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              {tvs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma TV cadastrada no sistema.
                  </td>
                </tr>
              ) : (
                tvs.map(tv => {
                  const tvUh = tv.uh_number || tv.custom_settings?.uh_number || '-';
                  const currentGuest = tv.guest_name || tv.custom_settings?.guest_name || null;

                  return (
                    <tr key={tv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#60a5fa',
                          padding: '3px 8px',
                          borderRadius: 6
                        }}>
                          {tvUh}
                        </span>
                      </td>

                      <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                        {tv.name}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {tv.device_id}</div>
                      </td>

                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {tv.group_name || tv.room_group || 'Geral'}
                      </td>

                      <td style={{ padding: '12px' }}>
                        {currentGuest ? (
                          <span style={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User size={14} /> {currentGuest}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Quarto Vago / Sem Hóspede
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: tv.is_online ? '#10b981' : 'var(--text-muted)'
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: tv.is_online ? '#10b981' : '#6b7280' }} />
                          {tv.is_online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {currentGuest && tvUh !== '-' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#f59e0b' }}
                            onClick={() => handleQuickCheckout(tvUh)}
                            title="Desvincular hóspede (Check-out)"
                          >
                            Check-Out
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
