import React, { useState, useRef } from 'react';
import { 
  FolderTree, Plus, Edit, Trash2, Users, Layers, Film, 
  Tv, CheckSquare, Square, Save, X, Sparkles, Key, Radio, Wifi,
  Sliders, Type, Clock, Sun, CloudSun, Cloud, CloudRain, Moon, AlignLeft, AlignRight, RotateCw,
  QrCode, Upload
} from 'lucide-react';

const POPULAR_CITIES = [
  { name: 'Salvador', state: 'BA' },
  { name: 'Trancoso', state: 'BA' },
  { name: 'Porto Seguro', state: 'BA' },
  { name: 'Ilhéus', state: 'BA' },
  { name: 'Praia do Forte', state: 'BA' },
  { name: 'Itacaré', state: 'BA' },
  { name: 'Morro de São Paulo', state: 'BA' },
  { name: 'São Paulo', state: 'SP' },
  { name: 'Rio de Janeiro', state: 'RJ' },
  { name: 'Angra dos Reis', state: 'RJ' },
  { name: 'Belo Horizonte', state: 'MG' },
  { name: 'Brasília', state: 'DF' },
  { name: 'Curitiba', state: 'PR' },
  { name: 'Florianópolis', state: 'SC' },
  { name: 'Fortaleza', state: 'CE' },
  { name: 'Recife', state: 'PE' },
  { name: 'Natal', state: 'RN' },
  { name: 'Gramado', state: 'RS' }
];

const renderWeatherIcon = (condition, size = 20) => {
  switch (condition) {
    case 'partly_cloudy':
      return <CloudSun size={size} color="#60a5fa" />;
    case 'cloudy':
      return <Cloud size={size} color="#94a3b8" />;
    case 'rain':
      return <CloudRain size={size} color="#38bdf8" />;
    case 'clear_night':
      return <Moon size={size} color="#c084fc" />;
    case 'sunny':
    default:
      return <Sun size={size} color="#fbbf24" />;
  }
};

const getConditionLabel = (condition) => {
  switch (condition) {
    case 'partly_cloudy': return 'Parcialmente Nublado';
    case 'cloudy': return 'Nublado';
    case 'rain': return 'Chuvoso';
    case 'clear_night': return 'Céu Limpo';
    case 'sunny':
    default: return 'Ensolarado';
  }
};

export default function GroupsView({ 
  groups = [], 
  tvs = [], 
  layouts = [], 
  playlists = [], 
  shortcuts = [], 
  onRefresh, 
  fetchHeaders 
}) {
  const appShortcuts = (shortcuts || []).filter(s => !s.is_hdmi);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState(null);
  const [selectedTvIds, setSelectedTvIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Group Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLayoutId, setFormLayoutId] = useState('');
  const [formPlaylistId, setFormPlaylistId] = useState('');
  const [formHdmiInputId, setFormHdmiInputId] = useState('HDMI 1');
  const [formHdmiLabel, setFormHdmiLabel] = useState('TV SKY');
  const [formShortcuts, setFormShortcuts] = useState([]);
  const [formCustomSettings, setFormCustomSettings] = useState({
    welcome_title: 'Seja Bem-vindo(a)!',
    welcome_subtitle: 'Aproveite a sua estadia com o melhor do entretenimento.',
    title_font_size: 32,
    show_clock: true,
    clock_font_size: 24,
    show_weather: true,
    weather_city: 'Salvador',
    weather_temp: '28°C',
    weather_condition: 'sunny',
    weather_font_size: 20,
    dock_icon_size: 72,
    dock_inner_icon_size: 36,
    dock_text_size: 13,
    clock_format: 'time_only',
    header_layout: 'welcome_left_widgets_right',
    wifi_ssid: 'Fasano-Guest',
    wifi_password: 'fasanobemvindo',
    wifi_qr_size: 110,
    auto_hide_dock: true,
    auto_hide_seconds: 15,
    volume_limit: 80,
    pin_code: '0000',
    wifi_qrcode_url: '',
    wifi_qr_size: 110
  });

  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef(null);

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadingQr(true);
    try {
      const res = await fetch('/api/media/upload-image', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {},
        body: formData
      });
      if (!res.ok) throw new Error('Falha no upload da imagem');
      const data = await res.json();
      setFormCustomSettings(prev => ({ ...prev, wifi_qrcode_url: data.url }));
    } catch (err) {
      alert('Erro ao enviar imagem: ' + err.message);
    } finally {
      setUploadingQr(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveQr = () => {
    setFormCustomSettings(prev => ({ ...prev, wifi_qrcode_url: '' }));
  };

  const [weatherData, setWeatherData] = useState(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);

  const handleFetchCityWeather = async (cityName) => {
    const city = cityName || formCustomSettings.weather_city || 'Salvador';
    setFetchingWeather(true);
    try {
      const res = await fetch(`/api/tvs/weather?city=${encodeURIComponent(city)}`, {
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
        setFormCustomSettings(prev => ({
          ...prev,
          weather_city: data.city || city,
          weather_temp: data.temperature || '28°C',
          weather_condition: data.condition || 'sunny'
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar clima:', e);
    } finally {
      setFetchingWeather(false);
    }
  };

  const openCreateModal = () => {
    setSelectedGroup(null);
    setFormName('');
    setFormDescription('');
    setFormLayoutId(layouts[0]?.id || '');
    setFormPlaylistId(playlists[0]?.id || '');
    setFormHdmiInputId('HDMI 1');
    setFormHdmiLabel('TV SKY');
    setFormShortcuts(appShortcuts.map(s => s.id));
    setFormCustomSettings({
      welcome_title: 'Seja Bem-vindo(a)!',
      welcome_subtitle: 'Aproveite a sua estadia com o melhor do entretenimento.',
      title_font_size: 32,
      show_clock: true,
      clock_font_size: 24,
      show_weather: true,
      weather_city: 'Salvador',
      weather_temp: '28°C',
      weather_condition: 'sunny',
      weather_font_size: 20,
      dock_icon_size: 72,
      dock_inner_icon_size: 36,
      dock_text_size: 13,
      clock_format: 'time_only',
      header_layout: 'welcome_left_widgets_right',
      wifi_ssid: 'Fasano-Guest',
      wifi_password: 'fasanobemvindo',
      wifi_qrcode_url: '',
      wifi_qr_size: 110,
      auto_hide_dock: true,
      auto_hide_seconds: 15,
      volume_limit: 80,
      pin_code: '0000'
    });
    setIsModalOpen(true);
    handleFetchCityWeather('Salvador');
  };

  const openEditModal = (group) => {
    setSelectedGroup(group);
    setFormName(group.name || '');
    setFormDescription(group.description || '');
    setFormLayoutId(group.layout_id || (layouts[0]?.id || ''));
    setFormPlaylistId(group.playlist_id || (playlists[0]?.id || ''));
    setFormHdmiInputId(group.hdmi_input_id || 'HDMI 1');
    setFormHdmiLabel(group.hdmi_label || 'TV SKY');
    setFormShortcuts(group.selected_shortcuts || []);
    const initialCity = group.custom_settings?.weather_city || 'Salvador';
    setFormCustomSettings({
      welcome_title: group.custom_settings?.welcome_title || 'Seja Bem-vindo(a)!',
      welcome_subtitle: group.custom_settings?.welcome_subtitle || 'Aproveite a sua estadia com o melhor do entretenimento.',
      title_font_size: group.custom_settings?.title_font_size || 32,
      show_clock: group.custom_settings?.show_clock ?? true,
      clock_font_size: group.custom_settings?.clock_font_size || 24,
      show_weather: group.custom_settings?.show_weather ?? true,
      weather_city: initialCity,
      weather_temp: group.custom_settings?.weather_temp || '28°C',
      weather_condition: group.custom_settings?.weather_condition || 'sunny',
      weather_font_size: group.custom_settings?.weather_font_size || 20,
      dock_icon_size: group.custom_settings?.dock_icon_size || 72,
      dock_inner_icon_size: group.custom_settings?.dock_inner_icon_size || 36,
      dock_text_size: group.custom_settings?.dock_text_size || 13,
      clock_format: group.custom_settings?.clock_format || 'time_only',
      header_layout: group.custom_settings?.header_layout || 'welcome_left_widgets_right',
      wifi_ssid: group.custom_settings?.wifi_ssid || '',
      wifi_password: group.custom_settings?.wifi_password || '',
      wifi_qrcode_url: group.custom_settings?.wifi_qrcode_url || '',
      wifi_qr_size: group.custom_settings?.wifi_qr_size || 110,
      auto_hide_dock: group.custom_settings?.auto_hide_dock ?? true,
      auto_hide_seconds: group.custom_settings?.auto_hide_seconds || 15,
      volume_limit: group.custom_settings?.volume_limit || 80,
      pin_code: group.custom_settings?.pin_code || '0000',
      ...(group.custom_settings || {})
    });
    setIsModalOpen(true);
    handleFetchCityWeather(initialCity);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor, informe o nome do grupo.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription,
        layout_id: formLayoutId ? parseInt(formLayoutId) : null,
        playlist_id: formPlaylistId ? parseInt(formPlaylistId) : null,
        hdmi_input_id: formHdmiInputId,
        hdmi_label: formHdmiLabel,
        selected_shortcuts: formShortcuts,
        custom_settings: formCustomSettings
      };

      const url = selectedGroup ? `/api/groups/${selectedGroup.id}` : '/api/groups';
      const method = selectedGroup ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao salvar grupo');
      }

      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Tem certeza que deseja excluir o grupo '${group.name}'? As TVs vinculadas terão seu grupo desvinculado, mas suas configurações individuais serão mantidas.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      if (!res.ok) throw new Error('Falha ao excluir grupo');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const openBulkModal = (group) => {
    setBulkGroupId(group.id);
    // Pré-selecionar TVs que já estão neste grupo
    const currentMemberIds = tvs.filter(t => t.group_id === group.id).map(t => t.id);
    setSelectedTvIds(currentMemberIds);
    setIsBulkModalOpen(true);
  };

  const toggleTvSelection = (tvId) => {
    if (selectedTvIds.includes(tvId)) {
      setSelectedTvIds(selectedTvIds.filter(id => id !== tvId));
    } else {
      setSelectedTvIds([...selectedTvIds, tvId]);
    }
  };

  const handleBulkAssign = async () => {
    setBulkSaving(true);
    try {
      const res = await fetch(`/api/groups/${bulkGroupId}/bulk-assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({ tv_ids: selectedTvIds })
      });
      if (!res.ok) throw new Error('Falha ao atribuir TVs em massa');
      setIsBulkModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm('Deseja criar os grupos padrão recomendados (TV Lobby, TV Quartos Standard, TV Vista Mar)?')) return;
    try {
      const res = await fetch('/api/groups/seed-defaults', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      const data = await res.json();
      alert(data.message || 'Padrões criados com sucesso!');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderTree size={22} color="var(--primary)" />
            Perfis & Grupos de TV com Herança
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Crie padrões de grupo (Lobby, Quartos, Vista Mar). Todas as TVs do grupo herdam layout, vídeos e Wi-Fi automaticamente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleSeedDefaults}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            title="Cria os grupos padrão de hotel caso não existam"
          >
            <Sparkles size={16} /> Restaurar Padrões de Hotel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Novo Grupo de TV
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--card-bg)',
          borderRadius: 16,
          border: '1px dashed var(--border-color)'
        }}>
          <FolderTree size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: 8 }}>Nenhum Grupo Cadastrado</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
            Crie grupos como "TV Lobby", "TV Quartos" e "TV Vista Mar" para definir padrões de playlist, layout e HDMI em massa.
          </p>
          <button className="btn btn-primary" onClick={handleSeedDefaults}>
            <Sparkles size={16} style={{ marginRight: 6 }} /> Criar Grupos Padrão do Hotel
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 20
        }}>
          {groups.map(group => {
            const memberTvs = tvs.filter(t => t.group_id === group.id);
            const layoutName = layouts.find(l => l.id === group.layout_id)?.name || 'Padrão do Sistema';
            const playlistName = playlists.find(p => p.id === group.playlist_id)?.name || 'Padrão do Sistema';

            return (
              <div 
                key={group.id} 
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 16,
                  border: '1px solid var(--border-color)',
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--primary)',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginBottom: 8
                    }}>
                      Perfil Herdado
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
                      {group.name}
                    </h3>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    <Tv size={14} /> {memberTvs.length} TV{memberTvs.length !== 1 ? 's' : ''}
                  </div>
                </div>

                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  margin: '0 0 16px 0',
                  minHeight: 38
                }}>
                  {group.description || 'Sem descrição cadastrada.'}
                </p>

                {/* Resumo dos Padrões Herdados */}
                <div style={{
                  background: 'rgba(0,0,0,0.18)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: '0.82rem',
                  marginBottom: 18,
                  border: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={14} /> Modelo de Layout:
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{layoutName}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Film size={14} /> Vídeos / Playlist:
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {playlistName}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={14} /> Entrada HDMI:
                    </span>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                      {group.hdmi_label || 'TV SKY'} ({group.hdmi_input_id || 'HDMI 1'})
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Key size={14} /> Senha de Saída (PIN):
                    </span>
                    <span style={{ fontWeight: 600, color: '#38bdf8', letterSpacing: 1 }}>
                      {group.custom_settings?.pin_code || '0000'}
                    </span>
                  </div>

                  {group.custom_settings?.wifi_ssid && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Wifi size={14} /> Rede Wi-Fi:
                      </span>
                      <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                        {group.custom_settings.wifi_ssid}
                      </span>
                    </div>
                  )}

                  {group.custom_settings?.wifi_qrcode_url && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <QrCode size={14} color="#34d399" /> QR Code Wi-Fi:
                      </span>
                      <span style={{ fontWeight: 600, color: '#34d399', fontSize: '0.78rem' }}>
                        Ativo ({group.custom_settings.wifi_qr_size || 110}px)
                      </span>
                    </div>
                  )}
                </div>

                {/* TVs Membros prévias */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>
                    TVs Vinculadas ({memberTvs.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 60, overflowY: 'auto' }}>
                    {memberTvs.length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nenhuma TV atribuída a este grupo ainda.
                      </span>
                    ) : (
                      memberTvs.map(t => (
                        <span 
                          key={t.id} 
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: 6,
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          {t.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem' }}
                    onClick={() => openBulkModal(group)}
                    title="Vincular várias TVs a este grupo com um clique"
                  >
                    <Users size={14} /> Atribuir em Massa
                  </button>

                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px' }}
                    onClick={() => openEditModal(group)}
                    title="Editar configurações padrão do grupo"
                  >
                    <Edit size={14} />
                  </button>

                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', color: '#ef4444' }}
                    onClick={() => handleDeleteGroup(group)}
                    title="Excluir grupo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Grupo (Padrão Visual Alinhado ao TVModal) */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease' }} onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
                }}>
                  <FolderTree size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: 0 }}>
                    {selectedGroup ? `Configurar Grupo: ${selectedGroup.name}` : 'Cadastrar Novo Grupo de TVs'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Personalize o layout visual, vídeos em loop, rede Wi-Fi, atalhos e widgets para este grupo.
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)} style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 16 }}>
                {/* 1. Identificação do Grupo */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderTree size={16} color="#60a5fa" /> Identificação do Perfil de Grupo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="form-label">Nome do Grupo *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formName} 
                        onChange={e => setFormName(e.target.value)} 
                        placeholder="Ex: TV Quartos Standard, TV Vista Mar, TV Suítes"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Descrição do Grupo</label>
                      <textarea 
                        className="form-textarea" 
                        rows={2}
                        value={formDescription} 
                        onChange={e => setFormDescription(e.target.value)} 
                        placeholder="Ex: Televisores das suítes e apartamentos com padrão de hotelaria."
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Modelo de Layout e Playlist de Vídeos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={14} color="#60a5fa" /> Modelo de Layout Padrão
                    </label>
                    <select 
                      className="form-select"
                      value={formLayoutId}
                      onChange={e => setFormLayoutId(e.target.value)}
                    >
                      {layouts.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Film size={14} color="#f59e0b" /> Playlist de Vídeos em Loop
                    </label>
                    <select 
                      className="form-select"
                      value={formPlaylistId}
                      onChange={e => setFormPlaylistId(e.target.value)}
                    >
                      <option value="">Nenhum vídeo em loop (Fundo escuro)</option>
                      {playlists.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.items?.length || 0} vídeos)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Entrada HDMI (SKY / Receptor) */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Tv size={18} color="#ef4444" />
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f87171' }}>
                      Entrada HDMI Padrão (TV SKY / Receptor)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Rótulo do Botão na TV</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formHdmiLabel} 
                        onChange={e => setFormHdmiLabel(e.target.value)} 
                        placeholder="Ex: TV SKY"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Porta HDMI Conectada</label>
                      <select 
                        className="form-select"
                        value={formHdmiInputId}
                        onChange={e => setFormHdmiInputId(e.target.value)}
                      >
                        <option value="HDMI 1">HDMI 1</option>
                        <option value="HDMI 2">HDMI 2 (Recomendado Sky)</option>
                        <option value="HDMI 3">HDMI 3</option>
                        <option value="HDMI 4">HDMI 4</option>
                        <option value="HW1">HW1 (Passthrough Direto)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Rede Wi-Fi & Segurança PIN */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wifi size={16} color="#10b981" /> Wi-Fi dos Quartos & Segurança PIN
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Rede Wi-Fi (SSID)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formCustomSettings.wifi_ssid || ''} 
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, wifi_ssid: e.target.value })} 
                        placeholder="Ex: Fasano-Guest"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Senha do Wi-Fi</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formCustomSettings.wifi_password || ''} 
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, wifi_password: e.target.value })} 
                        placeholder="Ex: fasanobemvindo"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Senha PIN de Saída do App *</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        className="form-input" 
                        value={formCustomSettings.pin_code || ''} 
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, pin_code: e.target.value })} 
                        placeholder="Ex: 0000"
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: 4 }}>
                        Padrão de senha herdado pelas TVs do grupo para voltar à launcher original.
                      </small>
                    </div>
                  </div>

                  {/* Upload da Imagem do QR Code do Wi-Fi */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <QrCode size={15} color="#34d399" /> Imagem do QR Code de Conexão Wi-Fi
                      </label>
                      {formCustomSettings.wifi_qrcode_url && (
                        <button 
                          type="button" 
                          onClick={handleRemoveQr} 
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          <Trash2 size={12} /> Remover QR Code
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {formCustomSettings.wifi_qrcode_url ? (
                        <div style={{
                          width: 72, height: 72, borderRadius: 10, background: '#fff',
                          padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2px solid #34d399'
                        }}>
                          <img 
                            src={formCustomSettings.wifi_qrcode_url} 
                            alt="QR Code Wi-Fi" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                          />
                        </div>
                      ) : (
                        <div style={{
                          width: 72, height: 72, borderRadius: 10, background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b',
                          border: '1px dashed rgba(255, 255, 255, 0.2)'
                        }}>
                          <QrCode size={30} />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleQrUpload} 
                          accept="image/png,image/jpeg,image/webp,image/svg+xml" 
                          style={{ display: 'none' }} 
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingQr}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Upload size={14} /> {uploadingQr ? 'Enviando imagem...' : (formCustomSettings.wifi_qrcode_url ? 'Trocar Imagem do QR Code' : 'Fazer Upload da Imagem do QR Code')}
                        </button>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Envie a imagem do QR Code (.png ou .jpg). Todas as TVs deste grupo herdarão esta imagem no topo da tela.
                        </div>
                      </div>
                    </div>

                    {/* Ajuste do Tamanho do QR Code na TV */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sliders size={14} color="#34d399" /> Tamanho do QR Code na TV
                        </label>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', padding: '2px 8px', borderRadius: 6 }}>
                          {formCustomSettings.wifi_qr_size || 110} px
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input 
                          type="range"
                          min="50"
                          max="220"
                          step="10"
                          value={formCustomSettings.wifi_qr_size || 110}
                          onChange={e => setFormCustomSettings({ ...formCustomSettings, wifi_qr_size: parseInt(e.target.value) })}
                          style={{ flex: 1, accentColor: '#34d399', cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {[
                          { label: 'Pequeno', size: 70 },
                          { label: 'Médio', size: 110 },
                          { label: 'Grande', size: 150 },
                          { label: 'Gigante', size: 190 }
                        ].map(preset => (
                          <button
                            key={preset.size}
                            type="button"
                            onClick={() => setFormCustomSettings({ ...formCustomSettings, wifi_qr_size: preset.size })}
                            style={{
                              padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer',
                              background: (formCustomSettings.wifi_qr_size || 110) === preset.size ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              border: (formCustomSettings.wifi_qr_size || 110) === preset.size ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                              color: (formCustomSettings.wifi_qr_size || 110) === preset.size ? '#34d399' : 'var(--text-muted)'
                            }}
                          >
                            {preset.label} ({preset.size}px)
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Mensagem de Boas-Vindas Padrão */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Type size={16} color="#f59e0b" /> Mensagem de Boas-Vindas Padrão
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Título de Boas-vindas</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formCustomSettings.welcome_title || ''} 
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, welcome_title: e.target.value })} 
                        placeholder="Ex: Seja Bem-vindo(a) ao Fasano"
                      />
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: 4 }}>
                        Personalizado automaticamente com o nome do hóspede quando sincronizado via Opera PMS / IFC8.
                      </small>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Subtítulo da Tela</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formCustomSettings.welcome_subtitle || ''} 
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, welcome_subtitle: e.target.value })} 
                        placeholder="Ex: Aproveite a sua estadia com o melhor do entretenimento."
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Widget de Previsão do Tempo Automático por Município (Open-Meteo API) */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sun size={18} color="#fbbf24" />
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff' }}>
                        Widget de Previsão do Tempo (Automático via API)
                      </span>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: '#fff' }}>
                      <input 
                        type="checkbox"
                        checked={formCustomSettings.show_weather !== false}
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, show_weather: e.target.checked })}
                        style={{ accentColor: '#fbbf24' }}
                      />
                      <span>Exibir na TV</span>
                    </label>
                  </div>

                  {formCustomSettings.show_weather !== false && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Seleção do Município */}
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>
                          Município / Cidade do Hotel
                        </label>
                        <select 
                          className="form-select"
                          value={
                            POPULAR_CITIES.some(c => c.name.toLowerCase() === (formCustomSettings.weather_city || '').toLowerCase())
                              ? POPULAR_CITIES.find(c => c.name.toLowerCase() === (formCustomSettings.weather_city || '').toLowerCase()).name
                              : 'CUSTOM'
                          }
                          onChange={e => {
                            const val = e.target.value;
                            if (val !== 'CUSTOM') {
                              setFormCustomSettings(prev => ({ ...prev, weather_city: val }));
                              handleFetchCityWeather(val);
                            }
                          }}
                        >
                          <option value="" disabled>Selecione o Município...</option>
                          {POPULAR_CITIES.map(c => (
                            <option key={c.name} value={c.name}>{c.name} - {c.state}</option>
                          ))}
                          <option value="CUSTOM">Outro Município (Digitar)...</option>
                        </select>

                        {/* Campo de texto livre para qualquer município */}
                        {(!POPULAR_CITIES.some(c => c.name.toLowerCase() === (formCustomSettings.weather_city || '').toLowerCase())) && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Digite o nome de qualquer cidade/município"
                              value={formCustomSettings.weather_city || ''} 
                              onChange={e => setFormCustomSettings({ ...formCustomSettings, weather_city: e.target.value })}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleFetchCityWeather(formCustomSettings.weather_city)}
                              disabled={fetchingWeather}
                              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <RotateCw size={13} className={fetchingWeather ? 'spin' : ''} />
                              Buscar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card de Clima em Tempo Real Automatizado via API */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        borderRadius: 12,
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: 'rgba(251, 191, 36, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {renderWeatherIcon(weatherData?.condition || formCustomSettings.weather_condition, 26)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                                {weatherData?.temperature || formCustomSettings.weather_temp || '28°C'}
                              </span>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#93c5fd' }}>
                                {weatherData?.condition_label || getConditionLabel(formCustomSettings.weather_condition)}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {formCustomSettings.weather_city || 'Salvador'} • Puxado automaticamente via Open-Meteo API
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleFetchCityWeather(formCustomSettings.weather_city)}
                          disabled={fetchingWeather}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
                          title="Atualizar dados climáticos em tempo real agora"
                        >
                          <RotateCw size={13} className={fetchingWeather ? 'spin' : ''} />
                          {fetchingWeather ? 'Sincronizando...' : 'Atualizar da API'}
                        </button>
                      </div>

                      {/* Ajuste de Tamanho da Previsão do Tempo no Grupo */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label className="form-label" style={{ fontSize: '0.76rem', marginBottom: 0 }}>
                            Tamanho da Previsão do Tempo (Temperatura e Cidade)
                          </label>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>
                            {formCustomSettings.weather_font_size || 20}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="14"
                          max="40"
                          step="1"
                          value={formCustomSettings.weather_font_size || 20}
                          onChange={e => setFormCustomSettings({ ...formCustomSettings, weather_font_size: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: '#fbbf24', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          {[
                            { label: 'Compacto', size: 16 },
                            { label: 'Normal', size: 20 },
                            { label: 'Grande', size: 26 },
                            { label: 'Destaque', size: 34 }
                          ].map(preset => (
                            <button
                              key={preset.size}
                              type="button"
                              onClick={() => setFormCustomSettings({ ...formCustomSettings, weather_font_size: preset.size })}
                              style={{
                                padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6, cursor: 'pointer',
                                background: (formCustomSettings.weather_font_size || 20) === preset.size ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                border: (formCustomSettings.weather_font_size || 20) === preset.size ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                                color: (formCustomSettings.weather_font_size || 20) === preset.size ? '#fbbf24' : '#94a3b8'
                              }}
                            >
                              {preset.label} ({preset.size}px)
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. Atalhos de Aplicativos Ativos no Grupo */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tv size={16} color="#60a5fa" />
                      Aplicativos Ativos no Grupo <strong>({formShortcuts.length} de {appShortcuts.length})</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span 
                        style={{ color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                        onClick={() => setFormShortcuts(appShortcuts.map(s => s.id))}
                      >
                        Marcar Todos
                      </span>
                      <span style={{ color: '#475569', fontSize: '0.78rem' }}>•</span>
                      <span 
                        style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}
                        onClick={() => setFormShortcuts([])}
                      >
                        Desmarcar Todos
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: 10, maxHeight: 180, overflowY: 'auto', padding: '4px'
                  }}>
                    {appShortcuts.map(sc => {
                      const isChecked = formShortcuts.includes(sc.id);
                      return (
                        <div 
                          key={sc.id}
                          onClick={() => {
                            if (isChecked) {
                              setFormShortcuts(formShortcuts.filter(id => id !== sc.id));
                            } else {
                              setFormShortcuts([...formShortcuts, sc.id]);
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: 10,
                            background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                        >
                          {isChecked ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} style={{ opacity: 0.4 }} />}
                          <span style={{ fontSize: '0.84rem', fontWeight: 500, color: isChecked ? '#fff' : 'var(--text-muted)' }}>
                            {sc.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 8. Padrão de Tamanhos, Posições & Widgets das TVs */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: 14, padding: 16
                }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#93c5fd', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#60a5fa" /> Padrão de Tamanhos, Posições & Widgets das TVs
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Todas as TVs vinculadas a este grupo herdarão estes tamanhos e widgets automaticamente, mantendo a identidade visual do hotel.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* 1. Tamanho dos Ícones da Dock */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa' }}>
                          <Tv size={14} /> Tamanho dos Ícones da Dock (Menu de Apps)
                        </label>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                          {formCustomSettings.dock_icon_size || 72} px
                        </span>
                      </div>

                      <input 
                        type="range"
                        min="48"
                        max="110"
                        step="4"
                        value={formCustomSettings.dock_icon_size || 72}
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, dock_icon_size: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />

                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {[
                          { label: 'Pequeno', size: 56 },
                          { label: 'Médio (Padrão)', size: 72 },
                          { label: 'Grande', size: 90 },
                          { label: 'Gigante', size: 108 }
                        ].map(preset => (
                          <button
                            key={preset.size}
                            type="button"
                            onClick={() => setFormCustomSettings({ ...formCustomSettings, dock_icon_size: preset.size })}
                            style={{
                              padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6, cursor: 'pointer',
                              background: (formCustomSettings.dock_icon_size || 72) === preset.size ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                              border: (formCustomSettings.dock_icon_size || 72) === preset.size ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: (formCustomSettings.dock_icon_size || 72) === preset.size ? '#60a5fa' : '#94a3b8'
                            }}
                          >
                            {preset.label} ({preset.size}px)
                          </button>
                        ))}
                      </div>

                      {/* Tamanho da Imagem / Logo dentro do Ícone */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tamanho da Imagem / Logo dentro do Ícone</span>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8' }}>{formCustomSettings.dock_inner_icon_size || 36} px</span>
                        </div>
                        <input 
                          type="range"
                          min="20"
                          max="76"
                          step="2"
                          value={formCustomSettings.dock_inner_icon_size || 36}
                          onChange={e => setFormCustomSettings({ ...formCustomSettings, dock_inner_icon_size: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          {[
                            { label: 'Pequeno', size: 26 },
                            { label: 'Médio (Padrão)', size: 36 },
                            { label: 'Grande', size: 48 },
                            { label: 'Extra', size: 60 }
                          ].map(preset => (
                            <button
                              key={preset.size}
                              type="button"
                              onClick={() => setFormCustomSettings({ ...formCustomSettings, dock_inner_icon_size: preset.size })}
                              style={{
                                padding: '2px 8px', fontSize: '0.70rem', borderRadius: 6, cursor: 'pointer',
                                background: (formCustomSettings.dock_inner_icon_size || 36) === preset.size ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                border: (formCustomSettings.dock_inner_icon_size || 36) === preset.size ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                color: (formCustomSettings.dock_inner_icon_size || 36) === preset.size ? '#38bdf8' : '#94a3b8'
                              }}
                            >
                              {preset.label} ({preset.size}px)
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tamanho da Fonte do Texto do App */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tamanho do Nome do App</span>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#a78bfa' }}>{formCustomSettings.dock_text_size || 13} sp</span>
                        </div>
                        <input 
                          type="range"
                          min="10"
                          max="22"
                          step="1"
                          value={formCustomSettings.dock_text_size || 13}
                          onChange={e => setFormCustomSettings({ ...formCustomSettings, dock_text_size: parseInt(e.target.value) })}
                          style={{ width: '100%', accentColor: '#a78bfa', cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    {/* 2. Tamanho da Mensagem na Tela */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
                          <Type size={14} /> Tamanho da Mensagem / Título na Tela
                        </label>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: 6 }}>
                          {formCustomSettings.title_font_size || 32} sp / px
                        </span>
                      </div>

                      <input 
                        type="range"
                        min="18"
                        max="54"
                        step="2"
                        value={formCustomSettings.title_font_size || 32}
                        onChange={e => setFormCustomSettings({ ...formCustomSettings, title_font_size: parseInt(e.target.value) })}
                        style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
                      />

                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        {[
                          { label: 'Compacto', size: 22 },
                          { label: 'Normal (Padrão)', size: 32 },
                          { label: 'Grande', size: 38 },
                          { label: 'Destaque', size: 48 }
                        ].map(preset => (
                          <button
                            key={preset.size}
                            type="button"
                            onClick={() => setFormCustomSettings({ ...formCustomSettings, title_font_size: preset.size })}
                            style={{
                              padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6, cursor: 'pointer',
                              background: (formCustomSettings.title_font_size || 32) === preset.size ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                              border: (formCustomSettings.title_font_size || 32) === preset.size ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: (formCustomSettings.title_font_size || 32) === preset.size ? '#f59e0b' : '#94a3b8'
                            }}
                          >
                            {preset.label} ({preset.size}px)
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Relógio Digital & Tamanho */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Clock size={15} color="#38bdf8" />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>Relógio Digital no Topo</span>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.78rem', color: '#fff' }}>
                          <input 
                            type="checkbox"
                            checked={formCustomSettings.show_clock !== false}
                            onChange={e => setFormCustomSettings({ ...formCustomSettings, show_clock: e.target.checked })}
                            style={{ accentColor: '#38bdf8' }}
                          />
                          <span>Exibir Relógio</span>
                        </label>
                      </div>

                      {formCustomSettings.show_clock !== false && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Tamanho da Fonte do Relógio</span>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8' }}>{formCustomSettings.clock_font_size || 24} sp</span>
                          </div>

                          <input 
                            type="range"
                            min="16"
                            max="46"
                            step="2"
                            value={formCustomSettings.clock_font_size || 24}
                            onChange={e => setFormCustomSettings({ ...formCustomSettings, clock_font_size: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                          />

                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            {[
                              { label: 'Compacto', size: 18 },
                              { label: 'Normal', size: 24 },
                              { label: 'Grande', size: 32 },
                              { label: 'Destaque', size: 40 }
                            ].map(preset => (
                              <button
                                key={preset.size}
                                type="button"
                                onClick={() => setFormCustomSettings({ ...formCustomSettings, clock_font_size: preset.size })}
                                style={{
                                  padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6, cursor: 'pointer',
                                  background: (formCustomSettings.clock_font_size || 24) === preset.size ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                  border: (formCustomSettings.clock_font_size || 24) === preset.size ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                  color: (formCustomSettings.clock_font_size || 24) === preset.size ? '#38bdf8' : '#94a3b8'
                                }}
                              >
                                {preset.label} ({preset.size}px)
                              </button>
                            ))}
                          </div>

                          {/* Escolha do Modelo: Apenas Horário ou Horário com Data */}
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                              Modelo de Exibição do Relógio
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setFormCustomSettings({ ...formCustomSettings, clock_format: 'time_only' })}
                                style={{
                                  padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                                  background: (formCustomSettings.clock_format !== 'time_and_date') ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                  border: (formCustomSettings.clock_format !== 'time_and_date') ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                  color: (formCustomSettings.clock_format !== 'time_and_date') ? '#fff' : '#94a3b8'
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Apenas Horário</div>
                                <div style={{ fontSize: '0.70rem', opacity: 0.7 }}>Ex: 16:51</div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setFormCustomSettings({ ...formCustomSettings, clock_format: 'time_and_date' })}
                                style={{
                                  padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                                  background: (formCustomSettings.clock_format === 'time_and_date') ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                  border: (formCustomSettings.clock_format === 'time_and_date') ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                  color: (formCustomSettings.clock_format === 'time_and_date') ? '#fff' : '#94a3b8'
                                }}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Horário com Data</div>
                                <div style={{ fontSize: '0.70rem', opacity: 0.7 }}>Ex: 16:51 Sex, 23 Out</div>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 4. Alinhamento dos Elementos no Topo */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: 8, display: 'block' }}>
                        Alinhamento dos Elementos no Topo da TV
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setFormCustomSettings({ ...formCustomSettings, header_layout: 'welcome_left_widgets_right' })}
                          style={{
                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                            background: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'welcome_left_widgets_right' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'welcome_left_widgets_right' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'welcome_left_widgets_right' ? '#60a5fa' : '#94a3b8',
                            fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <AlignLeft size={14} /> Mensagem ⬅️ | ➡️ Widgets
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormCustomSettings({ ...formCustomSettings, header_layout: 'widgets_left_welcome_right' })}
                          style={{
                            padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                            background: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'widgets_left_welcome_right' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'widgets_left_welcome_right' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                            color: (formCustomSettings.header_layout || 'welcome_left_widgets_right') === 'widgets_left_welcome_right' ? '#60a5fa' : '#94a3b8',
                            fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                          }}
                        >
                          <AlignRight size={14} /> Widgets ⬅️ | ➡️ Mensagem
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal de Atribuição em Massa */}
      {isBulkModalOpen && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="var(--primary)" />
                Atribuir TVs em Massa ao Grupo
              </h3>
              <button className="btn-icon" onClick={() => setIsBulkModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
              Marque as TVs que devem fazer parte deste grupo. Elas herdarão o layout, playlist, HDMI e configurações de Wi-Fi instantaneamente.
            </p>

            <div style={{
              maxHeight: 320,
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              {tvs.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhuma TV cadastrada.
                </div>
              ) : (
                tvs.map(tv => {
                  const isChecked = selectedTvIds.includes(tv.id);
                  const currentGroup = groups.find(g => g.id === tv.group_id);

                  return (
                    <div 
                      key={tv.id}
                      onClick={() => toggleTvSelection(tv.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        border: isChecked ? '1px solid var(--primary)' : '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isChecked ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} style={{ opacity: 0.4 }} />}
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-main)' }}>{tv.name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            UH: {tv.uh_number || tv.custom_settings?.uh_number || 'Sem UH'} | ID: {tv.device_id}
                          </div>
                        </div>
                      </div>

                      {currentGroup && (
                        <span style={{
                          fontSize: '0.72rem',
                          background: 'rgba(255,255,255,0.08)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          color: 'var(--text-muted)'
                        }}>
                          {currentGroup.name}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {selectedTvIds.length} TV{selectedTvIds.length !== 1 ? 's' : ''} selecionada{selectedTvIds.length !== 1 ? 's' : ''}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={bulkSaving}
                  onClick={handleBulkAssign}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> {bulkSaving ? 'Gravando...' : 'Aplicar Atribuição'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
