import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, RefreshCw, Filter, Clock, FileText,
  Shield, Wifi, Zap, Trash2, Monitor, HardDrive,
  ChevronDown, Activity, AlertTriangle, CheckCircle2
} from 'lucide-react';

// ─── Color & icon map per event type ────────────────────────────────────────
const EVENT_META = {
  BOOT:               { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.12)', icon: Zap,            label: 'Boot' },
  HEARTBEAT:          { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', icon: Activity,       label: 'Heartbeat' },
  PAIR:               { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)',  icon: Monitor,        label: 'Pareamento' },
  BIND:               { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)',  icon: HardDrive,      label: 'Vinculação' },
  ASSIGN:             { color: '#818cf8', bg: 'rgba(129, 140, 248, 0.12)', icon: HardDrive,      label: 'Atribuição' },
  PMS_CHECKIN:        { color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)',  icon: CheckCircle2,   label: 'Check-in PMS' },
  PMS_CHECKOUT:       { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',  icon: AlertTriangle,  label: 'Check-out PMS' },
  PMS_ROOM_UPDATE:    { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)',  icon: FileText,       label: 'Update PMS' },
  PMS_SYNC:           { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)', icon: RefreshCw,      label: 'Sync PMS' },
  APP_CLEANUP:        { color: '#f472b6', bg: 'rgba(244, 114, 182, 0.12)', icon: Trash2,         label: 'Limpeza Apps' },
  APP_CLEANUP_ADB:    { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.12)', icon: Trash2,         label: 'Limpeza ADB' },
  ADB_SETUP:          { color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.12)',  icon: Shield,         label: 'ADB Setup' },
  APP_OPEN:           { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)',  icon: Monitor,        label: 'App Aberto' },
  HDMI_SWITCH:        { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)',  icon: Wifi,           label: 'HDMI Switch' },
  PLAY_ERROR:         { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',   icon: AlertTriangle,  label: 'Erro Playback' },
};

const DEFAULT_META = { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.10)', icon: FileText, label: 'Evento' };

function getEventMeta(eventType) {
  return EVENT_META[eventType] || DEFAULT_META;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return dateStr; }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d atrás`;
  } catch { return ''; }
}

export default function DeviceLogsModal({ tv, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [summary, setSummary] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = useCallback(async () => {
    if (!tv?.id) return;
    setLoading(true);
    try {
      const typeParam = selectedType !== 'ALL' ? `&event_type=${selectedType}` : '';
      const res = await fetch(`/api/tvs/${tv.id}/logs?limit=300${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs da TV:', err);
    } finally {
      setLoading(false);
    }
  }, [tv?.id, selectedType]);

  const fetchSummary = useCallback(async () => {
    if (!tv?.id) return;
    try {
      const res = await fetch(`/api/tvs/${tv.id}/logs/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Erro ao carregar resumo de logs:', err);
    }
  }, [tv?.id]);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [fetchLogs, fetchSummary]);

  // Filter by search term
  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.event_type && log.event_type.toLowerCase().includes(term)) ||
      (log.message && log.message.toLowerCase().includes(term))
    );
  });

  // Get unique event types for the filter dropdown
  const eventTypes = summary?.by_type ? Object.keys(summary.by_type).sort() : [];

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease-out',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '90%', maxWidth: 960, maxHeight: '88vh',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.96))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 80px rgba(59, 130, 246, 0.08)',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(59, 130, 246, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
            }}>
              <FileText size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                Logs da TV: {tv?.name || 'Desconhecida'}
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {tv?.custom_settings?.uh_number ? `UH ${tv.custom_settings.uh_number}` : ''} 
                {tv?.device_id ? ` • ${tv.device_id}` : ''}
                {summary ? ` • ${summary.total_logs} eventos registrados` : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 10, padding: 8, cursor: 'pointer', color: 'var(--text-muted)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── SUMMARY CARDS ────────────────────────────────────────────── */}
        {summary && eventTypes.length > 0 && (
          <div style={{
            padding: '14px 24px',
            display: 'flex', gap: 8, flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          }}>
            {eventTypes.map(type => {
              const meta = getEventMeta(type);
              const count = summary.by_type[type] || 0;
              const isActive = selectedType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(isActive ? 'ALL' : type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 8,
                    fontSize: '0.75rem', fontWeight: 600,
                    cursor: 'pointer', border: 'none',
                    background: isActive ? meta.color : meta.bg,
                    color: isActive ? '#0f172a' : meta.color,
                    transition: 'all 0.2s',
                    opacity: isActive ? 1 : 0.85,
                  }}
                >
                  <meta.icon size={13} />
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* ── SEARCH & CONTROLS ────────────────────────────────────────── */}
        <div style={{
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10, padding: '0 12px',
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', color: '#fff',
                fontSize: '0.85rem', padding: '8px 0',
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
          </div>

          <button
            onClick={() => { fetchLogs(); fetchSummary(); }}
            style={{
              background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* ── LOG ENTRIES ──────────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '8px 24px 24px',
        }}>
          {loading && logs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 60,
              color: 'var(--text-muted)', fontSize: '0.9rem',
            }}>
              <RefreshCw size={28} className="spin" style={{ marginBottom: 12, opacity: 0.4 }} />
              <div>Carregando logs...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 60,
              color: 'var(--text-muted)', fontSize: '0.9rem',
            }}>
              <FileText size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div>Nenhum log encontrado para esta TV.</div>
              <div style={{ fontSize: '0.78rem', marginTop: 4, opacity: 0.7 }}>
                Os logs são registrados automaticamente durante operações de pareamento, PMS e limpeza de apps.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredLogs.map((log, idx) => {
                const meta = getEventMeta(log.event_type);
                const Icon = meta.icon;
                const isExpanded = expandedLogId === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      background: isExpanded ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isExpanded ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!isExpanded) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isExpanded) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.03)';
                      }
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: meta.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 1,
                    }}>
                      <Icon size={15} color={meta.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px',
                          borderRadius: 4, background: meta.bg, color: meta.color,
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                        }}>
                          {log.event_type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} />
                          {formatTimeAgo(log.created_at)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.82rem', color: isExpanded ? '#e2e8f0' : 'var(--text-secondary)',
                        lineHeight: 1.45,
                        overflow: isExpanded ? 'visible' : 'hidden',
                        textOverflow: isExpanded ? 'unset' : 'ellipsis',
                        whiteSpace: isExpanded ? 'normal' : 'nowrap',
                        maxHeight: isExpanded ? 'none' : '1.4em',
                        transition: 'all 0.2s',
                      }}>
                        {log.message}
                      </div>
                      {isExpanded && (
                        <div style={{
                          marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} />
                            {formatDateTime(log.created_at)}
                          </span>
                          <span style={{ opacity: 0.5 }}>ID: #{log.id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ANIMATIONS ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
