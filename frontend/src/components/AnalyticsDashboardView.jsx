import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, Clock, Tv, PlaySquare, TrendingUp, 
  RefreshCw, CheckCircle2, AlertCircle, Calendar, Filter, 
  ExternalLink, Layers, Award, Users, Monitor, Zap, Flame,
  Search, ShieldCheck, ChevronRight, Eye
} from 'lucide-react';

export default function AnalyticsDashboardView({ tvs = [] }) {
  const [period, setPeriod] = useState('7days'); // 'today', '7days', '30days', 'all'
  const [selectedUh, setSelectedUh] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('rooms'); // 'rooms', 'stays'
  const [searchFilter, setSearchFilter] = useState('');

  // Safe number helper
  const safeNum = (v, fallback = 0) => {
    if (v === null || v === undefined || isNaN(Number(v))) return fallback;
    return Number(v);
  };

  // Fetch analytics overview
  const fetchAnalytics = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (period) params.append('period', period);
      if (selectedUh) params.append('uh_number', selectedUh);

      const res = await fetch(`/api/analytics/overview?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Falha ao obter dados: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Erro ao carregar Analytics:', err);
      setError(err.message || 'Erro ao comunicar com o servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, selectedUh]);

  // Safe KPI variables
  const totalScreenHours = safeNum(data?.kpis?.total_screen_hours ?? data?.kpis?.total_screen_on_hours);
  const totalLauncherHours = safeNum(data?.kpis?.total_launcher_hours);
  const totalExternalHours = safeNum(data?.kpis?.total_external_app_hours);
  const totalClicks = safeNum(data?.kpis?.total_app_clicks ?? data?.kpis?.total_clicks);
  const activeTvs = safeNum(data?.kpis?.active_tvs ?? data?.kpis?.active_tvs_count);
  const mostPopularApp = data?.kpis?.most_popular_app;
  const mostActiveRoom = data?.kpis?.most_active_room;

  // Color map for known apps
  const getAppColor = (appName = '') => {
    const lower = (appName || '').toLowerCase();
    if (lower.includes('netflix')) return '#E50914';
    if (lower.includes('youtube')) return '#FF0000';
    if (lower.includes('prime')) return '#00A8E1';
    if (lower.includes('spotify')) return '#1DB954';
    if (lower.includes('sky') || lower.includes('hdmi')) return '#F59E0B';
    if (lower.includes('globo')) return '#F97316';
    if (lower.includes('disney')) return '#113CCF';
    if (lower.includes('max') || lower.includes('hbo')) return '#7B2CBF';
    return '#3B82F6';
  };

  // Filtered rooms table
  const filteredRooms = useMemo(() => {
    if (!data?.room_summaries) return [];
    if (!searchFilter.trim()) return data.room_summaries;
    const query = searchFilter.toLowerCase();
    return data.room_summaries.filter(r => 
      (r.uh_number && String(r.uh_number).toLowerCase().includes(query)) ||
      (r.guest_name && String(r.guest_name).toLowerCase().includes(query)) ||
      (r.tv_name && String(r.tv_name).toLowerCase().includes(query))
    );
  }, [data?.room_summaries, searchFilter]);

  // Hourly distribution max for normalization
  const maxHourlyVal = useMemo(() => {
    if (!data?.hourly_distribution || data.hourly_distribution.length === 0) return 1;
    const vals = data.hourly_distribution.map(h => safeNum(h.count ?? h.interactions_count));
    return Math.max(...vals, 1);
  }, [data?.hourly_distribution]);

  // Daily trend max for normalization
  const maxDailyHours = useMemo(() => {
    if (!data?.daily_trend || data.daily_trend.length === 0) return 1;
    const vals = data.daily_trend.map(d => safeNum(d.screen_hours ?? d.screen_on_hours));
    return Math.max(...vals, 1);
  }, [data?.daily_trend]);

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* HEADER CONTROLS BAR */}
      <div className="glass-card" style={{
        padding: '18px 24px',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Left: Period selector buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} color="var(--accent-primary)" /> Período:
          </span>

          {[
            { id: 'today', label: 'Hoje' },
            { id: '7days', label: 'Últimos 7 Dias' },
            { id: '30days', label: 'Últimos 30 Dias' },
            { id: 'all', label: 'Histórico Geral' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: period === p.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                background: period === p.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: period === p.id ? '#60a5fa' : 'var(--text-secondary)'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Right: Room Filter + Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              className="form-select"
              value={selectedUh}
              onChange={e => setSelectedUh(e.target.value)}
              style={{ padding: '7px 12px', fontSize: '0.82rem', minWidth: 160 }}
            >
              <option value="">Todas as UHs</option>
              {tvs.filter(t => t.uh_number).map(t => (
                <option key={t.id} value={t.uh_number}>
                  UH {t.uh_number} {t.guest_name ? `(${t.guest_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing || loading}
            style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            title="Recarregar métricas"
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* 6 MAIN KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        {/* KPI 1: Total Screen On */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Tv size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {totalScreenHours.toFixed(1)}h
            </div>
            <div className="stat-label">Total de Tela Ligada</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Tempo total com a TV ativa
            </div>
          </div>
        </div>

        {/* KPI 2: Launcher Hours (Brand Exposure) */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <PlaySquare size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {totalLauncherHours.toFixed(1)}h
            </div>
            <div className="stat-label">Launcher Fasano Ativa</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 4 }}>
              {totalScreenHours > 0 
                ? `${Math.round((totalLauncherHours / totalScreenHours) * 100)}% de exposição da marca` 
                : '100% no launcher'}
            </div>
          </div>
        </div>

        {/* KPI 3: External Streaming / HDMI */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
            <ExternalLink size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {totalExternalHours.toFixed(1)}h
            </div>
            <div className="stat-label">Streaming & HDMI SKY</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Apps de hóspedes e TV ao vivo
            </div>
          </div>
        </div>

        {/* KPI 4: Total App Clicks */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Zap size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {totalClicks}
            </div>
            <div className="stat-label">Total de Interações / Cliques</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {activeTvs > 0 
                ? `Média de ${(totalClicks / activeTvs).toFixed(1)} por TV ativa` 
                : 'Nenhum clique registrado'}
            </div>
          </div>
        </div>

        {/* KPI 5: Most Popular App */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Award size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {mostPopularApp ? (mostPopularApp.app_name || mostPopularApp.name || '—') : '—'}
            </div>
            <div className="stat-label">App Mais Clicado</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {mostPopularApp && mostPopularApp.clicks > 0 ? `${mostPopularApp.clicks} acessos de hóspedes` : 'Sem acessos registrados'}
            </div>
          </div>
        </div>

        {/* KPI 6: Most Active Room */}
        <div className="glass-card stat-card" style={{ padding: 20 }}>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <Flame size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {mostActiveRoom && mostActiveRoom.uh && mostActiveRoom.uh !== '-' ? `UH ${mostActiveRoom.uh}` : '—'}
            </div>
            <div className="stat-label">UH com Maior Uso</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {mostActiveRoom && safeNum(mostActiveRoom.hours) > 0 ? `${safeNum(mostActiveRoom.hours).toFixed(1)}h de uso ativo` : 'Sem dados'}
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN CHARTS SECTION */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 24,
        marginBottom: 28
      }}>
        {/* CHART 1: APP RANKING (HORIZONTAL BARS) */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="var(--accent-primary)" />
                Ranking de Aplicativos & HDMI
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Frequência de abertura por hóspedes neste período
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 6 }}>
              {data?.app_ranking?.length || 0} apps monitorados
            </span>
          </div>

          {(!data?.app_ranking || data.app_ranking.length === 0) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nenhum clique de aplicativo registrado ainda neste período.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.app_ranking.slice(0, 8).map((app, index) => {
                const clicks = safeNum(app.clicks ?? app.total_clicks);
                const percentage = safeNum(app.percentage, totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0);
                const barColor = app.color || getAppColor(app.app_name);

                return (
                  <div key={app.package_name + index}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: index === 0 ? '#F59E0B' : index === 1 ? '#94A3B8' : index === 2 ? '#B45309' : 'rgba(255,255,255,0.1)',
                          color: index < 3 ? '#000' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>
                          {app.app_name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: barColor }}>
                          {clicks} {clicks === 1 ? 'clique' : 'cliques'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: 36, textAlign: 'right' }}>
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div style={{
                      height: 8,
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(percentage, 3)}%`,
                        background: barColor,
                        borderRadius: 4,
                        transition: 'width 0.6s ease-out'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CHART 2: HOURLY PEAK AUDIENCE HEATMAP (00h - 23h) */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--accent-cyan)" />
                Picos de Audiência dos Hóspedes (00h às 23h)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Horários de maior engajamento com a TV durante a estadia
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#22d3ee', background: 'rgba(6, 182, 212, 0.1)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              24h Contínuas
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: 20 }}>
            {/* Histogram Bars */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(24, 1fr)',
              alignItems: 'flex-end',
              gap: 3,
              height: 160,
              paddingBottom: 8,
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              {(data?.hourly_distribution || Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}h`, count: 0 }))).map(h => {
                const count = safeNum(h.count ?? h.interactions_count);
                const heightPct = Math.max(8, Math.round((count / maxHourlyVal) * 100));
                const isPeak = heightPct > 65;
                const barColor = isPeak 
                  ? 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)' 
                  : count > 0 
                    ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.6) 0%, rgba(2, 132, 199, 0.3) 100%)' 
                    : 'rgba(255, 255, 255, 0.05)';

                return (
                  <div
                    key={h.hour}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end'
                    }}
                    title={`${h.hour} - ${count} interações`}
                  >
                    <div style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      background: barColor,
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.4s ease'
                    }} />
                  </div>
                );
              })}
            </div>

            {/* Hour Labels */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(24, 1fr)',
              gap: 3,
              marginTop: 6
            }}>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} style={{
                  fontSize: '0.62rem',
                  color: (i % 3 === 0) ? 'var(--text-secondary)' : 'transparent',
                  textAlign: 'center',
                  fontWeight: 600
                }}>
                  {i}h
                </div>
              ))}
            </div>

            {/* Time Slot Guidance */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)'
            }}>
              <span>🌙 Madrugada (00h-06h)</span>
              <span>☀️ Manhã (06h-12h)</span>
              <span>🌤️ Tarde (12h-18h)</span>
              <span>✨ Noite / Pico (18h-23h)</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHART 3: DAILY TREND (LAST 7-14 DAYS) */}
      {data?.daily_trend && data.daily_trend.length > 0 && (
        <div className="glass-card" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="var(--accent-emerald)" />
                Evolução Diária de Uso da TV
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Horas totais de TV ligada por dia no hotel
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.daily_trend.length}, 1fr)`,
            alignItems: 'flex-end',
            gap: 12,
            height: 140,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            {data.daily_trend.map(d => {
              const screenHours = safeNum(d.screen_hours ?? d.screen_on_hours);
              const heightPct = Math.max(10, Math.round((screenHours / maxDailyHours) * 100));
              return (
                <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#34d399', marginBottom: 4 }}>
                    {screenHours.toFixed(1)}h
                  </span>
                  <div style={{
                    width: '100%',
                    maxWidth: 42,
                    height: `${heightPct}%`,
                    background: 'linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.3) 100%)',
                    borderRadius: '6px 6px 0 0'
                  }} />
                </div>
              );
            })}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${data.daily_trend.length}, 1fr)`,
            gap: 12,
            marginTop: 8
          }}>
            {data.daily_trend.map(d => (
              <div key={d.date} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 600 }}>
                {d.label || (d.date ? d.date.substring(5) : '')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAILED DATA TABS: ROOMS VS STAYS */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20
        }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setActiveSubTab('rooms')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: activeSubTab === 'rooms' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                background: activeSubTab === 'rooms' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                color: activeSubTab === 'rooms' ? '#60a5fa' : 'var(--text-secondary)'
              }}
            >
              <Tv size={16} />
              <span>Indicadores por Quarto / UH ({filteredRooms.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('stays')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: activeSubTab === 'stays' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                background: activeSubTab === 'stays' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                color: activeSubTab === 'stays' ? '#60a5fa' : 'var(--text-secondary)'
              }}
            >
              <Users size={16} />
              <span>Histórico por Hóspede / Estadia ({data?.guest_stays?.length || 0})</span>
            </button>
          </div>

          {/* Search filter input */}
          {activeSubTab === 'rooms' && (
            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por UH ou hóspede..."
                className="form-control"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{ paddingLeft: 34, paddingRight: 12, height: 36, fontSize: '0.82rem' }}
              />
            </div>
          )}
        </div>

        {/* TAB 1 CONTENT: ROOMS TABLE */}
        {activeSubTab === 'rooms' && (
          <div style={{ overflowX: 'auto' }}>
            {filteredRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Nenhuma TV com dados para os critérios selecionados.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 14px' }}>Quarto / UH</th>
                    <th style={{ padding: '12px 14px' }}>Hóspede Atual</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Tela Ligada</th>
                    <th style={{ padding: '12px 14px' }}>Launcher vs Apps</th>
                    <th style={{ padding: '12px 14px' }}>App Preferido</th>
                    <th style={{ padding: '12px 14px' }}>Total de Cliques</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((r, i) => {
                    const screenHrs = safeNum(r.screen_hours);
                    const launcherHrs = safeNum(r.launcher_hours);
                    const launcherPct = screenHrs > 0 
                      ? Math.min(100, Math.round((launcherHrs / screenHrs) * 100))
                      : 100;

                    return (
                      <tr 
                        key={r.tv_id || i}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '0.85rem',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px', fontWeight: 700, color: '#f8fafc' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.8rem'
                            }}>
                              {r.uh_number || '—'}
                            </div>
                            <div>
                              <div>UH {r.uh_number || 'Sem UH'}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.tv_name}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px', color: r.guest_name ? '#f1f5f9' : 'var(--text-muted)' }}>
                          {r.guest_name || 'Desocupado / Vago'}
                        </td>

                        <td style={{ padding: '14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: r.is_online ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                            color: r.is_online ? '#34d399' : '#94a3b8'
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: r.is_online ? '#10b981' : '#64748b'
                            }} />
                            {r.is_online ? 'Online' : 'Offline'}
                          </span>
                        </td>

                        <td style={{ padding: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                          {screenHrs.toFixed(1)}h
                        </td>

                        <td style={{ padding: '14px', minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                            <span style={{ color: '#10b981' }}>Launcher {launcherPct}%</span>
                            <span style={{ color: '#a78bfa' }}>Apps {100 - launcherPct}%</span>
                          </div>
                          <div style={{
                            height: 6,
                            width: '100%',
                            background: 'rgba(139, 92, 246, 0.3)',
                            borderRadius: 3,
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${launcherPct}%`,
                              background: '#10b981',
                              borderRadius: 3
                            }} />
                          </div>
                        </td>

                        <td style={{ padding: '14px' }}>
                          {r.top_app && r.top_app !== 'N/A' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: 'rgba(255,255,255,0.06)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: getAppColor(r.top_app)
                            }}>
                              {r.top_app}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          {safeNum(r.app_clicks)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2 CONTENT: GUEST STAYS HISTORY */}
        {activeSubTab === 'stays' && (
          <div style={{ overflowX: 'auto' }}>
            {(!data?.guest_stays || data.guest_stays.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Nenhum histórico de estadia registrado ainda no PMS / FIAS.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 14px' }}>Hóspede</th>
                    <th style={{ padding: '12px 14px' }}>UH</th>
                    <th style={{ padding: '12px 14px' }}>Período da Estadia</th>
                    <th style={{ padding: '12px 14px' }}>Uso da TV Durante a Estadia</th>
                    <th style={{ padding: '12px 14px' }}>Launcher vs Apps</th>
                    <th style={{ padding: '12px 14px' }}>Status da Estadia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.guest_stays.map((stay, i) => {
                    const checkInStr = stay.first_seen ? new Date(stay.first_seen).toLocaleDateString('pt-BR') : '—';
                    const checkOutStr = stay.last_seen ? new Date(stay.last_seen).toLocaleDateString('pt-BR') : 'Presente';
                    const screenHrs = safeNum(stay.screen_hours);
                    const launcherHrs = safeNum(stay.launcher_hours);
                    const launcherPct = screenHrs > 0 ? Math.min(100, Math.round((launcherHrs / screenHrs) * 100)) : 100;

                    return (
                      <tr 
                        key={stay.uh_number + (stay.guest_name || '') + i}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <td style={{ padding: '14px', fontWeight: 600, color: '#f8fafc' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem'
                            }}>
                              <Users size={14} />
                            </div>
                            <span>{stay.guest_name || 'Hóspede'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px', fontWeight: 700, color: '#38bdf8' }}>
                          UH {stay.uh_number || '—'}
                        </td>

                        <td style={{ padding: '14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {checkInStr} → {checkOutStr}
                        </td>

                        <td style={{ padding: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                          {screenHrs.toFixed(1)}h
                        </td>

                        <td style={{ padding: '14px', minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 4 }}>
                            <span style={{ color: '#10b981' }}>{launcherPct}% Launcher</span>
                            <span style={{ color: '#a78bfa' }}>{100 - launcherPct}% Apps</span>
                          </div>
                          <div style={{
                            height: 6,
                            width: '100%',
                            background: 'rgba(139, 92, 246, 0.3)',
                            borderRadius: 3,
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${launcherPct}%`,
                              background: '#10b981',
                              borderRadius: 3
                            }} />
                          </div>
                        </td>

                        <td style={{ padding: '14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399'
                          }}>
                            Estadia Registrada
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
