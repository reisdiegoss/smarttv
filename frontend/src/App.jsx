import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, MonitorPlay, Film, Layers, Radio, Plus, RefreshCw, 
  Settings, CheckCircle2, AlertCircle, Wifi, Play, Edit, 
  Trash2, QrCode, HardDrive, Eye, ExternalLink, Cpu,
  Shield, Download, LogOut, User as UserIcon, Send,
  FolderTree, Building2, ChevronDown
} from 'lucide-react';

import TVSimulator from './components/TVSimulator';
import TVModal from './components/TVModal';
import PairModal from './components/PairModal';
import PlaylistModal from './components/PlaylistModal';
import LayoutModal from './components/LayoutModal';
import BrandAppIcon from './components/BrandAppIcon';
import LoginView from './components/LoginView';
import AuditTrailView from './components/AuditTrailView';
import GroupsView from './components/GroupsView';
import PMSIntegrationView from './components/PMSIntegrationView';
import ShortcutsView from './components/ShortcutsView';

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('smarttv_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('smarttv_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('smarttv_token');
    localStorage.removeItem('smarttv_user');
    setAuthToken(null);
    setCurrentUser(null);
  };

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'tvs', 'simulator', 'playlists', 'layouts', 'shortcuts', 'groups', 'pms', 'audit'
  const [tvs, setTvs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [layouts, setLayouts] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [selectedTvForSimulator, setSelectedTvForSimulator] = useState(null);
  const [serverOnline, setServerOnline] = useState(true);

  // Modals state
  const [isTvModalOpen, setIsTvModalOpen] = useState(false);
  const [editingTv, setEditingTv] = useState(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState(null);
  const [isApkMenuOpen, setIsApkMenuOpen] = useState(false);
  const apkMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (apkMenuRef.current && !apkMenuRef.current.contains(e.target)) {
        setIsApkMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keep ref to pause background polling while user is actively filling out modals OR simulating a TV
  const isAnyModalOpen = isTvModalOpen || isPairModalOpen || isPlaylistModalOpen || isLayoutModalOpen;
  const isModalOpenRef = useRef(isAnyModalOpen);
  isModalOpenRef.current = isAnyModalOpen;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Load all initial data from backend API
  const loadData = async () => {
    try {
      const [tvsRes, layoutsRes, playlistsRes, shortcutsRes, mediaRes, groupsRes] = await Promise.all([
        fetch('/api/tvs').then(r => r.json()),
        fetch('/api/layouts').then(r => r.json()),
        fetch('/api/playlists').then(r => r.json()),
        fetch('/api/shortcuts').then(r => r.json()),
        fetch('/api/media').then(r => r.json()),
        fetch('/api/groups').then(r => r.json()).catch(() => [])
      ]);

      setTvs(tvsRes || []);
      setLayouts(layoutsRes || []);
      setPlaylists(playlistsRes || []);
      setShortcuts(shortcutsRes || []);
      setMediaList(mediaRes || []);
      setGroups(groupsRes || []);
      setServerOnline(true);

      // Select first TV for simulator ONLY if none selected yet, and preserve the active simulation room
      setSelectedTvForSimulator(prev => {
        if (!prev) {
          return (tvsRes && tvsRes.length > 0) ? tvsRes[0] : null;
        }
        const found = (tvsRes || []).find(t => t.id === prev.id);
        return found || prev;
      });
    } catch (err) {
      console.error('Erro ao conectar com a API:', err);
      setServerOnline(false);
    }
  };

  useEffect(() => {
    if (!authToken) return;
    loadData();
    const interval = setInterval(() => {
      // NUNCA disparar refresh em background se houver modal aberto OU se estiver na tela de Simulação!
      if (!isModalOpenRef.current && activeTabRef.current !== 'simulator') {
        loadData();
      }
    }, 10000); // Polling every 10s only if no modal is open and not simulating

    // Setup WebSocket for instant real-time events
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tvs`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'tv_update' && !isModalOpenRef.current && activeTabRef.current !== 'simulator') {
          loadData();
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [authToken]);

  // TV Save / Update
  const handleSaveTv = async (tvData) => {
    try {
      if (tvData.id) {
        // Update existing TV
        await fetch(`/api/tvs/${tvData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tvData)
        });
      } else {
        // Create TV
        await fetch('/api/tvs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...tvData,
            device_id: `TV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          })
        });
      }
      setIsTvModalOpen(false);
      setEditingTv(null);
      await loadData();
    } catch (err) {
      alert('Erro ao salvar TV: ' + err.message);
    }
  };

  // TV Delete
  const handleDeleteTv = async (tvId) => {
    if (!window.confirm('Deseja realmente remover esta TV do sistema?')) return;
    try {
      await fetch(`/api/tvs/${tvId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // TV Claim / Pair with PIN
  const handleClaimTv = async (claimData) => {
    const res = await fetch('/api/tvs/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claimData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao parear');
    }
    await loadData();
  };

  // TV Assign physical device/PIN to existing TV profile
  const handleAssignDevice = async (assignData) => {
    const res = await fetch('/api/tvs/assign-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao vincular dispositivo');
    }
    await loadData();
  };

  // Layout Save / Update
  const handleSaveLayout = async (layoutData) => {
    try {
      if (layoutData.id) {
        await fetch(`/api/layouts/${layoutData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(layoutData)
        });
      } else {
        await fetch('/api/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(layoutData)
        });
      }
      setIsLayoutModalOpen(false);
      setEditingLayout(null);
      await loadData();
    } catch (err) {
      alert('Erro ao salvar layout: ' + err.message);
    }
  };

  // Delete Layout
  const handleDeleteLayout = async (layoutId) => {
    if (!window.confirm('Deseja remover este modelo de layout?')) return;
    try {
      const res = await fetch(`/api/layouts/${layoutId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao excluir layout');
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Apply layout to all TVs
  const handleApplyLayoutToAll = async (layout) => {
    if (!window.confirm(`Deseja aplicar o layout "${layout.name}" em TODAS as ${tvs.length} TVs cadastradas?`)) return;
    try {
      for (const t of tvs) {
        await fetch(`/api/tvs/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout_id: layout.id })
        });
      }
      alert(`Layout "${layout.name}" aplicado a todas as TVs com sucesso!`);
      await loadData();
    } catch (err) {
      alert('Erro ao aplicar layout: ' + err.message);
    }
  };


  // Playlist Save / Update
  const handleSavePlaylist = async (playlistData) => {
    try {
      if (playlistData.id) {
        await fetch(`/api/playlists/${playlistData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playlistData)
        });
      } else {
        await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playlistData)
        });
      }
      setIsPlaylistModalOpen(false);
      setEditingPlaylist(null);
      await loadData();
    } catch (err) {
      alert('Erro ao salvar playlist: ' + err.message);
    }
  };

  // Delete Playlist
  const handleDeletePlaylist = async (playlistId) => {
    if (!window.confirm('Deseja remover esta playlist?')) return;
    try {
      await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      await loadData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Upload Video Media
  const handleUploadMedia = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erro ao subir vídeo');
    }
    const saved = await res.json();
    await loadData();
    return saved;
  };

  // Calculations for dashboard counters
  const totalTvs = tvs.length;
  const onlineTvs = tvs.filter(t => t.is_online).length;
  const totalPlaylists = playlists.length;
  const totalMedia = mediaList.length;

  // Selected TV object for Simulator
  const currentSimulatorTv = tvs.find(t => t.id === selectedTvForSimulator?.id) || selectedTvForSimulator || tvs[0] || null;
  const currentSimulatorLayout = layouts.find(l => l.id === currentSimulatorTv?.layout_id) || layouts[0] || null;
  const currentSimulatorPlaylist = playlists.find(p => p.id === currentSimulatorTv?.playlist_id) || playlists[0] || null;

  if (!authToken) {
    return (
      <LoginView 
        onLoginSuccess={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">
            <Tv size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
              SmartTV <span style={{ color: '#3b82f6' }}>Manager</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Painel Central & Launcher
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Cpu size={18} /> Visão Geral
          </div>
          <div 
            className={`nav-item ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            <FolderTree size={18} /> Perfis de Grupo ({groups.length})
          </div>
          <div 
            className={`nav-item ${activeTab === 'tvs' ? 'active' : ''}`}
            onClick={() => setActiveTab('tvs')}
          >
            <Tv size={18} /> Smart TVs ({totalTvs})
          </div>
          <div 
            className={`nav-item ${activeTab === 'pms' ? 'active' : ''}`}
            onClick={() => setActiveTab('pms')}
          >
            <Building2 size={18} /> Integração PMS (IFC8)
          </div>
          <div 
            className={`nav-item ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <MonitorPlay size={18} /> Simulador da TV
          </div>
          <div 
            className={`nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlists')}
          >
            <Film size={18} /> Vídeos & Playlists
          </div>
          <div 
            className={`nav-item ${activeTab === 'layouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('layouts')}
          >
            <Layers size={18} /> Modelos de Layout
          </div>
          <div 
            className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            <Radio size={18} /> Apps & HDMI SKY
          </div>
          <div 
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Shield size={18} /> Trilha de Auditoria
          </div>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: serverOnline ? '#10b981' : '#ef4444',
                boxShadow: serverOnline ? '0 0 10px #10b981' : 'none'
              }} />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {serverOnline ? 'PostgreSQL Conectado' : 'Desconectado'}
              </div>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ padding: '4px 8px' }}
              onClick={loadData}
              title="Atualizar dados agora"
            >
              <RefreshCw size={12} />
            </button>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Host: 192.168.168.26:5432
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* TOP HEADER */}
        <header className="top-header">
          <div>
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Painel de Controle'}
              {activeTab === 'groups' && 'Perfis & Grupos de TV com Herança'}
              {activeTab === 'tvs' && 'Gerenciamento de Smart TVs'}
              {activeTab === 'pms' && 'Integração Hospitality PMS (IFC8 / FIAS)'}
              {activeTab === 'simulator' && 'Simulador em Tempo Real da TV'}
              {activeTab === 'playlists' && 'Playlists & Mídias de Vídeo'}
              {activeTab === 'layouts' && 'Personalizador de Layouts da Launcher'}
              {activeTab === 'shortcuts' && 'Configurações de Apps & Entrada HDMI SKY'}
              {activeTab === 'audit' && 'Trilha de Auditoria do Sistema'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'dashboard' && 'Status das TVs na rede, reprodução de vídeo e controle individualizado.'}
              {activeTab === 'groups' && 'Crie padrões de layout, playlist e HDMI para Lobby, Quartos e Vista Mar com herança.'}
              {activeTab === 'tvs' && 'Configure o nome, playlist, atalhos de apps e HDMI individual de cada TV.'}
              {activeTab === 'pms' && 'Servidor IFC8 (192.168.162.18) integrando Thexpos, Vingcard e Leucotron em tempo real.'}
              {activeTab === 'simulator' && 'Teste e interaja com a Launcher exatamente como o hóspede/cliente vê na TV.'}
              {activeTab === 'playlists' && 'Gerencie os vídeos MP4 que rodam em sequência contínua no APK.'}
              {activeTab === 'layouts' && 'Escolha entre Luxo Hotel, Split Screen, Vitrine ou Mural Digital.'}
              {activeTab === 'shortcuts' && 'Mapeamento de pacotes Android (Netflix, YouTube) e porta HDMI Sky.'}
              {activeTab === 'audit' && 'Histórico completo de auditoria com IP, data/hora, o que era antes e o que foi alterado.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Split Button de Download Direto + Opções */}
            <div ref={apkMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <a
                href="/fasano-smarttv-v1.0.9.apk"
                download="fasano-smarttv-v1.0.9.apk"
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderColor: 'rgba(59, 130, 246, 0.45)',
                  color: '#60a5fa',
                  fontWeight: 700,
                  padding: '8px 14px',
                  textDecoration: 'none',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0
                }}
                title="Download direto do APK v1.0.9 (fasano-smarttv-v1.0.9.apk)"
              >
                <Download size={16} /> Baixar APK v1.0.9
              </a>

              <button
                type="button"
                onClick={() => setIsApkMenuOpen(!isApkMenuOpen)}
                style={{
                  background: 'rgba(59, 130, 246, 0.22)',
                  border: '1px solid rgba(59, 130, 246, 0.45)',
                  borderLeft: 'none',
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  color: '#60a5fa',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Mais opções de download (Universal, Latest e GitHub Releases)"
              >
                <ChevronDown size={15} />
              </button>

              {isApkMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: 320,
                  background: 'rgba(15, 23, 42, 0.98)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
                  padding: 10,
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ padding: '4px 8px', fontSize: '0.70rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}>
                    DISPONÍVEL NA RAIZ & DOWNLOAD DIRETO
                  </div>

                  <a
                    href="/fasano-smarttv-v1.0.9.apk"
                    download="fasano-smarttv-v1.0.9.apk"
                    onClick={() => setIsApkMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.14)',
                      color: '#93c5fd',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    <Download size={16} color="#38bdf8" />
                    <div>
                      <div>Baixar Versão Oficial (v1.0.9)</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>fasano-smarttv-v1.0.9.apk</div>
                    </div>
                  </a>

                  <a
                    href="/smarttv-launcher.apk"
                    download="smarttv-launcher.apk"
                    onClick={() => setIsApkMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    <HardDrive size={16} color="#94a3b8" />
                    <div>
                      <div>APK Universal na Raiz</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>smarttv-launcher.apk (raiz do sistema /opt)</div>
                    </div>
                  </a>

                  <a
                    href="/fasano-smarttv-latest.apk"
                    download="fasano-smarttv-latest.apk"
                    onClick={() => setIsApkMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    <HardDrive size={16} color="#94a3b8" />
                    <div>
                      <div>APK Alias Flutuante</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>fasano-smarttv-latest.apk</div>
                    </div>
                  </a>

                  <a
                    href="https://github.com/reisdiegoss/smarttv/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsApkMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(168, 85, 247, 0.1)',
                      color: '#c084fc',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      marginTop: 2
                    }}
                  >
                    <ExternalLink size={16} color="#c084fc" />
                    <div>
                      <div>Releases de Todas as Versões</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Ver histórico no GitHub</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <button 
              className="btn btn-secondary"
              onClick={() => setIsPairModalOpen(true)}
            >
              <QrCode size={16} /> Parear com PIN
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => { setEditingTv(null); setIsTvModalOpen(true); }}
            >
              <Plus size={16} /> Nova TV
            </button>

            {/* User Session & Logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 12,
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                color: '#cbd5e1'
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.25)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserIcon size={14} />
                </div>
                <span>{currentUser?.username || 'admin'}</span>
              </div>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
                title="Sair do sistema"
                style={{ padding: '6px 8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* VIEW 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Stats Metric Cards */}
            <div className="stats-grid">
              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                  <Tv size={26} />
                </div>
                <div>
                  <div className="stat-value">{totalTvs}</div>
                  <div className="stat-label">Total de TVs Cadastradas</div>
                </div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <div className="stat-value">{onlineTvs}</div>
                  <div className="stat-label">TVs Conectadas / Online</div>
                </div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                  <Film size={26} />
                </div>
                <div>
                  <div className="stat-value">{totalPlaylists}</div>
                  <div className="stat-label">Playlists Ativas</div>
                </div>
              </div>

              <div className="glass-card stat-card">
                <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' }}>
                  <HardDrive size={26} />
                </div>
                <div>
                  <div className="stat-value">{totalMedia}</div>
                  <div className="stat-label">Vídeos no Servidor</div>
                </div>
              </div>
            </div>

            {/* Quick Live Simulator Highlight */}
            {currentSimulatorTv && (
              <div className="glass-card" style={{ padding: 28, marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Prévia Ao Vivo da TV: {currentSimulatorTv.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Visualização interativa da tela como o usuário vê no quarto.
                    </p>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('simulator')}
                  >
                    Abrir Modo Tela Cheia <ExternalLink size={14} />
                  </button>
                </div>

                <TVSimulator 
                  tv={currentSimulatorTv}
                  layout={currentSimulatorLayout}
                  playlist={currentSimulatorPlaylist}
                  shortcuts={shortcuts}
                />
              </div>
            )}

            {/* TV Grid List */}
            <h3 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: 16 }}>Smart TVs Gerenciadas</h3>
            <div className="tv-grid">
              {tvs.map(tv => (
                <div key={tv.id} className="glass-card tv-card">
                  <div className="tv-card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ fontSize: '1.1rem', color: '#fff' }}>{tv.name}</h4>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {tv.room_group} • ID: <code>{tv.device_id}</code>
                      </div>
                    </div>
                    <span className={`badge ${tv.is_online ? 'badge-online' : 'badge-offline'}`}>
                      <span className="dot" /> {tv.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="tv-card-body">
                    {/* UH & Hóspede (Hospitalidade / PMS) OU Mensagem Institucional */}
                    {tv.pms_enabled !== false ? (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        marginBottom: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.82rem'
                      }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🏨 UH {tv.uh_number || tv.custom_settings?.uh_number || '---'}</span>
                          {tv.custom_settings?.room_type && (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.22)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              color: '#93c5fd',
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontWeight: 700
                            }}>
                              {tv.custom_settings.room_type}
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {tv.custom_settings?.room_status && (
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontWeight: 600,
                              background: tv.custom_settings.room_status.toLowerCase().includes('vac') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: tv.custom_settings.room_status.toLowerCase().includes('vac') ? '#34d399' : '#fbbf24',
                              border: `1px solid ${tv.custom_settings.room_status.toLowerCase().includes('vac') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                            }}>
                              {tv.custom_settings.room_status}
                            </span>
                          )}
                          <span style={{ 
                            color: (tv.guest_name || tv.custom_settings?.guest_name) ? '#34d399' : 'var(--text-muted)', 
                            fontWeight: 500, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap', 
                            maxWidth: 130 
                          }} title={tv.guest_name || tv.custom_settings?.guest_name || 'Quarto Vago'}>
                            👤 {tv.guest_name || tv.custom_settings?.guest_name || 'Vago'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        marginBottom: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.82rem'
                      }}>
                        <span style={{ color: '#c084fc', fontWeight: 600 }}>
                          🏢 Institucional
                        </span>
                        <span style={{ 
                          color: '#d8b4fe', 
                          fontStyle: 'italic',
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap', 
                          maxWidth: 160 
                        }} title={tv.custom_settings?.welcome_title || 'Mensagem Fixa'}>
                          💬 {tv.custom_settings?.welcome_title || 'Mensagem Fixa'}
                        </span>
                      </div>
                    )}

                    {!tv.is_paired && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        marginBottom: 8,
                        fontSize: '0.74rem',
                        color: '#f59e0b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 600
                      }}>
                        <span>Aguardando APK</span>
                        <code>PIN: {tv.pairing_code || tv.device_id}</code>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Layout:</span>
                        <strong style={{ color: '#fff' }}>{tv.layout?.name || 'Hotel Luxo'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Playlist:</span>
                        <strong style={{ color: '#fff' }}>{tv.playlist?.name || 'Padrão'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Entrada SKY:</span>
                        <strong style={{ color: '#f87171' }}>{tv.hdmi_label} ({tv.hdmi_input_id})</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>IP na Rede:</span>
                        <code>{tv.ip_address || '192.168.168.X'}</code>
                      </div>
                    </div>
                  </div>

                  <div className="tv-card-footer">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setSelectedTvForSimulator(tv); setActiveTab('simulator'); }}
                    >
                      <Eye size={14} /> Simular
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setEditingTv(tv); setIsTvModalOpen(true); }}
                        title="Configurar TV"
                      >
                        <Settings size={14} />
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteTv(tv.id)}
                        title="Remover TV"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 2: SMART TVS MANAGEMENT TABLE & CARDS */}
        {activeTab === 'tvs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Total de <strong>{tvs.length}</strong> televisores cadastrados no sistema.
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => { setEditingTv(null); setIsTvModalOpen(true); }}
              >
                <Plus size={16} /> Cadastrar Nova TV
              </button>
            </div>

            {/* Filtros Rápidos por Grupo de TV */}
            {groups.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <button 
                  className={`btn btn-sm ${selectedGroupFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedGroupFilter('ALL')}
                >
                  Todos ({tvs.length})
                </button>
                {groups.map(g => {
                  const count = tvs.filter(t => t.group_id === g.id).length;
                  return (
                    <button 
                      key={g.id}
                      className={`btn btn-sm ${String(selectedGroupFilter) === String(g.id) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSelectedGroupFilter(String(g.id))}
                    >
                      {g.name} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="tv-grid">
              {(selectedGroupFilter === 'ALL' ? tvs : tvs.filter(t => String(t.group_id) === String(selectedGroupFilter))).map(tv => (
                <div key={tv.id} className="glass-card tv-card">
                  <div className="tv-card-header">
                    <div>
                      <h4 style={{ fontSize: '1.15rem', color: '#fff' }}>{tv.name}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {tv.group_name && (
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            padding: '1px 7px',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}>
                            {tv.group_name}
                          </span>
                        )}
                        <span>{tv.room_group} • PIN: <strong>{tv.pairing_code || '---'}</strong></span>
                      </div>
                    </div>
                    <span className={`badge ${tv.is_online ? 'badge-online' : 'badge-offline'}`}>
                      <span className="dot" /> {tv.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="tv-card-body">
                    {/* UH & Hóspede (Hospitalidade / PMS) */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem'
                    }}>
                      <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>UH {tv.custom_settings?.uh_number || '---'}</span>
                        {tv.custom_settings?.room_type && (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.22)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#fbbf24',
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 700
                          }}>
                            {tv.custom_settings.room_type}
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {tv.custom_settings?.room_status && (
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: 4,
                            fontWeight: 600,
                            background: tv.custom_settings.room_status.toLowerCase().includes('vac') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: tv.custom_settings.room_status.toLowerCase().includes('vac') ? '#34d399' : '#fbbf24',
                            border: `1px solid ${tv.custom_settings.room_status.toLowerCase().includes('vac') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                          }}>
                            {tv.custom_settings.room_status}
                          </span>
                        )}
                        <span style={{ 
                          color: tv.custom_settings?.guest_name ? '#34d399' : 'var(--text-muted)', 
                          fontWeight: 500, 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap', 
                          maxWidth: 130 
                        }} title={tv.custom_settings?.guest_name || 'Quarto Vago'}>
                          👤 {tv.custom_settings?.guest_name || 'Vago'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Layout da Launcher:</span>
                        <strong style={{ color: '#60a5fa' }}>{tv.layout?.name || 'Hotel Luxo'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Vídeos / Playlist:</span>
                        <strong style={{ color: '#f59e0b' }}>{tv.playlist?.name || 'Padrão'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Canal TV Sky:</span>
                        <strong style={{ color: '#ef4444' }}>{tv.hdmi_label} ({tv.hdmi_input_id})</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Atalhos de Apps:</span>
                        <span>{tv.selected_shortcuts?.length || shortcuts.length} habilitados</span>
                      </div>
                    </div>
                  </div>

                  <div className="tv-card-footer">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setSelectedTvForSimulator(tv); setActiveTab('simulator'); }}
                    >
                      <Eye size={14} /> Simular Tela
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setEditingTv(tv); setIsTvModalOpen(true); }}
                      >
                        <Edit size={14} /> Configurar
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteTv(tv.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: INTERACTIVE TV SIMULATOR */}
        {activeTab === 'simulator' && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
              padding: 16, background: 'rgba(15, 23, 42, 0.7)', borderRadius: 16, border: '1px solid var(--border-subtle)'
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Selecione a TV para simular:
              </span>
              <select 
                className="form-select"
                style={{ maxWidth: 360 }}
                value={currentSimulatorTv?.id || ''}
                onChange={e => {
                  const found = tvs.find(t => t.id === parseInt(e.target.value));
                  if (found) setSelectedTvForSimulator(found);
                }}
              >
                {[...tvs].sort((a, b) => {
                  const numA = parseInt((a.uh_number || a.name || '').replace(/\D/g, ''), 10);
                  const numB = parseInt((b.uh_number || b.name || '').replace(/\D/g, ''), 10);
                  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
                  return (a.name || '').localeCompare(b.name || '');
                }).map(tv => (
                  <option key={tv.id} value={tv.id}>
                    {tv.name} {tv.uh_number ? `(UH ${tv.uh_number})` : ''} — {tv.guest_name ? `👤 ${tv.guest_name}` : '🟢 Vago'}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Use as setas <strong>◀ e ▶</strong> do seu teclado físico ou os botões abaixo para simular o controle remoto.
              </span>
            </div>

            {currentSimulatorTv && (
              <div className="glass-card" style={{ padding: 32 }}>
                <TVSimulator 
                  tv={currentSimulatorTv}
                  layout={currentSimulatorLayout}
                  playlist={currentSimulatorPlaylist}
                  shortcuts={shortcuts}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: PLAYLISTS & MEDIA */}
        {activeTab === 'playlists' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Playlists determinam quais vídeos rodam em loop na Launcher das TVs.
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => { setEditingPlaylist(null); setIsPlaylistModalOpen(true); }}
              >
                <Plus size={16} /> Nova Playlist
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
              {playlists.map(pl => (
                <div key={pl.id} className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', color: '#fff' }}>{pl.name}</h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        {pl.description || 'Sem descrição'}
                      </p>
                    </div>
                    <span className="badge badge-online">
                      {pl.loop_playback ? 'Loop Ativo' : 'Tocar 1x'}
                    </span>
                  </div>

                  <div style={{ flex: 1, margin: '14px 0' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Vídeos na Sequência ({pl.items?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pl.items?.map((item, idx) => (
                        <div 
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 8,
                            fontSize: '0.82rem', color: '#fff'
                          }}
                        >
                          <span style={{ color: '#60a5fa', fontWeight: 700 }}>#{idx + 1}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.media?.title || 'Vídeo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setEditingPlaylist(pl); setIsPlaylistModalOpen(true); }}
                    >
                      <Edit size={14} /> Editar Vídeos
                    </button>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeletePlaylist(pl.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: LAYOUT PRESETS */}
        {activeTab === 'layouts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                Selecione, edite e crie novos modelos visuais da tela para renderizar no APK das Smart TVs.
              </div>
              <button 
                className="btn btn-primary"
                onClick={() => { setEditingLayout(null); setIsLayoutModalOpen(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Plus size={16} /> Novo Modelo de Layout
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
              {layouts.map(layout => (
                <div key={layout.id} className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: '1.25rem', color: '#fff' }}>{layout.name}</h4>
                      <code style={{ fontSize: '0.75rem', color: '#60a5fa' }}>código: {layout.code}</code>
                    </div>
                    {layout.is_default && (
                      <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                        Padrão
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: 18 }}>
                    {layout.description}
                  </p>

                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)', borderRadius: 12, padding: 14,
                    border: '1px solid var(--border-subtle)', marginBottom: 18, fontSize: '0.8rem', color: 'var(--text-muted)'
                  }}>
                    <div>Posição do Menu: <strong>{layout.config.dock_position || layout.config.sidebar_position || 'Inferior'}</strong></div>
                    <div>Relógio Ativo: <strong>{layout.config.show_clock !== false ? 'Sim' : 'Não'}</strong></div>
                    <div>Auto-ocultar Menu: <strong>{layout.config.auto_hide_dock ? `Sim (${layout.config.auto_hide_seconds || 15}s)` : 'Sempre Visível'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (currentSimulatorTv) {
                          setSelectedTvForSimulator({ ...currentSimulatorTv, layout_id: layout.id, layout: layout });
                          setActiveTab('simulator');
                        }
                      }}
                      title="Visualizar no Simulador Web"
                    >
                      <Eye size={14} /> Simulador
                    </button>

                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingLayout(layout);
                        setIsLayoutModalOpen(true);
                      }}
                      title="Editar Propriedades do Modelo"
                    >
                      <Edit size={14} /> Editar
                    </button>

                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                      onClick={() => handleApplyLayoutToAll(layout)}
                      title="Aplicar este layout para todas as TVs"
                    >
                      <Send size={14} /> Aplicar a Todas
                    </button>

                    {!layout.is_default && (
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteLayout(layout.id)}
                        title="Excluir Modelo"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 6: APPS & HDMI SKY SHORTCUTS */}
        {activeTab === 'shortcuts' && (
          <ShortcutsView 
            shortcuts={shortcuts} 
            onRefresh={loadData} 
          />
        )}

        {/* VIEW: TV GROUPS & INHERITANCE */}
        {activeTab === 'groups' && (
          <GroupsView 
            groups={groups}
            tvs={tvs}
            layouts={layouts}
            playlists={playlists}
            shortcuts={shortcuts}
            onRefresh={loadData}
          />
        )}

        {/* VIEW: PMS HOSPITALITY INTEGRATION (IFC8 / FIAS) */}
        {activeTab === 'pms' && (
          <PMSIntegrationView 
            tvs={tvs}
            groups={groups}
            onRefresh={loadData}
          />
        )}

        {/* VIEW 7: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <AuditTrailView />
        )}
      </main>

      {/* MODALS */}
      <TVModal 
        isOpen={isTvModalOpen}
        onClose={() => setIsTvModalOpen(false)}
        onSave={handleSaveTv}
        tv={editingTv}
        layouts={layouts}
        playlists={playlists}
        shortcuts={shortcuts}
        groups={groups}
      />

      <PairModal 
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onClaim={handleClaimTv}
        onAssignDevice={handleAssignDevice}
        tvs={tvs}
        layouts={layouts}
        playlists={playlists}
      />

      <PlaylistModal 
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlist={editingPlaylist}
        mediaList={mediaList}
        onSave={handleSavePlaylist}
        onUploadMedia={handleUploadMedia}
        onDeleteMedia={() => {}}
      />

      <LayoutModal
        isOpen={isLayoutModalOpen}
        onClose={() => { setIsLayoutModalOpen(false); setEditingLayout(null); }}
        onSave={handleSaveLayout}
        layout={editingLayout}
      />

    </div>
  );
}
