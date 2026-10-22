import React, { useState, useEffect, useRef } from 'react';
import { X, Tv, Save, CheckSquare, Square, Layers, Film, Wifi, QrCode, Upload, Trash2, Smartphone, Key, Eye, Sliders, User, Building, Lock, FolderTree } from 'lucide-react';

export default function TVModal({ isOpen, onClose, onSave, tv, layouts, playlists, shortcuts, groups = [] }) {
  const [pmsEnabled, setPmsEnabled] = useState(true);
  const [name, setName] = useState('');
  const [roomGroup, setRoomGroup] = useState('Geral');
  const [groupId, setGroupId] = useState('');
  const [layoutId, setLayoutId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [enableHdmi, setEnableHdmi] = useState(true);
  const [hdmiInputId, setHdmiInputId] = useState('HDMI 1');
  const [hdmiLabel, setHdmiLabel] = useState('TV SKY');
  const [selectedShortcuts, setSelectedShortcuts] = useState([]);
  const [customSettings, setCustomSettings] = useState({
    welcome_title: 'Seja Bem-vindo(a)!',
    welcome_subtitle: 'Aproveite o melhor do entretenimento.',
    wifi_ssid: '',
    wifi_password: '',
    wifi_qrcode_url: '',
    wifi_qr_size: 110,
    auto_hide_dock: false,
    auto_hide_seconds: 15,
    uh_number: '',
    guest_name: '',
    admin_exit_pin: '0000'
  });
  const [uploadingQr, setUploadingQr] = useState(false);
  const fileInputRef = useRef(null);

  const appShortcuts = shortcuts.filter(s => !s.is_hdmi);

  useEffect(() => {
    if (!isOpen) return;

    if (tv) {
      setName(tv.name || '');
      setRoomGroup(tv.room_group || 'Geral');
      setGroupId(tv.group_id ? String(tv.group_id) : '');
      setLayoutId(tv.layout_id || (layouts[0]?.id || ''));
      setPlaylistId(tv.playlist_id || (playlists[0]?.id || ''));
      setDeviceId(tv.device_id || '');
      setPairingCode(tv.pairing_code || '');
      setPmsEnabled(tv.pms_enabled !== false);
      
      const isHdmiOn = tv.hdmi_input_id !== 'NONE' && tv.hdmi_input_id !== 'DISABLED' && tv.hdmi_input_id !== null && tv.custom_settings?.hide_hdmi !== true;
      setEnableHdmi(isHdmiOn);
      setHdmiInputId(isHdmiOn ? (tv.hdmi_input_id || 'HDMI 1') : 'HDMI 1');
      setHdmiLabel(tv.hdmi_label || 'TV SKY');
      
      if (Array.isArray(tv.selected_shortcuts) && tv.selected_shortcuts.length > 0) {
        setSelectedShortcuts(tv.selected_shortcuts.filter(id => appShortcuts.some(a => a.id === id)));
      } else if (Array.isArray(tv.selected_shortcuts) && tv.selected_shortcuts.length === 0 && tv.id) {
        setSelectedShortcuts([]);
      } else {
        setSelectedShortcuts(appShortcuts.map(s => s.id));
      }
      
      if (tv.custom_settings) {
        setCustomSettings({
          welcome_title: tv.custom_settings.welcome_title || 'Seja Bem-vindo(a)!',
          welcome_subtitle: tv.custom_settings.welcome_subtitle || 'Aproveite o melhor do entretenimento.',
          wifi_ssid: tv.custom_settings.wifi_ssid || '',
          wifi_password: tv.custom_settings.wifi_password || '',
          wifi_qrcode_url: tv.custom_settings.wifi_qrcode_url || '',
          wifi_qr_size: tv.custom_settings.wifi_qr_size || 110,
          auto_hide_dock: tv.custom_settings.auto_hide_dock ?? false,
          auto_hide_seconds: tv.custom_settings.auto_hide_seconds || 15,
          uh_number: tv.uh_number || tv.custom_settings.uh_number || '',
          guest_name: tv.guest_name || tv.custom_settings.guest_name || '',
          admin_exit_pin: tv.pin_code || tv.custom_settings.admin_exit_pin || tv.custom_settings.pin_code || '0000',
          ...tv.custom_settings
        });
      }
    } else {
      setName('');
      setRoomGroup('Geral');
      setGroupId(groups[0]?.id ? String(groups[0].id) : '');
      setLayoutId(layouts[0]?.id || '');
      setPlaylistId('');
      setDeviceId('');
      setPairingCode('');
      setPmsEnabled(true);
      setEnableHdmi(true);
      setHdmiInputId('HDMI 1');
      setHdmiLabel('TV SKY');
      setSelectedShortcuts(appShortcuts.map(s => s.id));
      setCustomSettings({
        welcome_title: 'Seja Bem-vindo(a)!',
        welcome_subtitle: 'Aproveite o melhor do entretenimento.',
        wifi_ssid: '',
        wifi_password: '',
        wifi_qrcode_url: '',
        wifi_qr_size: 110,
        auto_hide_dock: false,
        auto_hide_seconds: 15,
        uh_number: '',
        guest_name: '',
        admin_exit_pin: '0000'
      });
    }
  }, [isOpen, tv?.id]);

  if (!isOpen) return null;

  const toggleShortcut = (id) => {
    setSelectedShortcuts(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedShortcuts(appShortcuts.map(s => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedShortcuts([]);
  };

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadingQr(true);
    try {
      const res = await fetch('/api/media/upload-image', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Falha no upload da imagem');
      const data = await res.json();
      setCustomSettings(prev => ({ ...prev, wifi_qrcode_url: data.url }));
    } catch (err) {
      alert('Erro ao enviar imagem: ' + err.message);
    } finally {
      setUploadingQr(false);
    }
  };

  const handleRemoveQr = () => {
    setCustomSettings(prev => ({ ...prev, wifi_qrcode_url: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Informe o nome da TV');

    const cleanPin = customSettings.admin_exit_pin ? customSettings.admin_exit_pin.trim() : '0000';
    const cleanUh = customSettings.uh_number ? customSettings.uh_number.trim() : '';
    const cleanGuest = customSettings.guest_name ? customSettings.guest_name.trim() : '';

    onSave({
      id: tv?.id,
      name,
      room_group: roomGroup,
      group_id: groupId ? parseInt(groupId) : null,
      uh_number: pmsEnabled ? (cleanUh || undefined) : undefined,
      guest_name: pmsEnabled ? (cleanGuest || undefined) : undefined,
      pms_enabled: pmsEnabled,
      pin_code: cleanPin,
      layout_id: layoutId ? parseInt(layoutId) : null,
      playlist_id: playlistId ? parseInt(playlistId) : null,
      device_id: deviceId.trim() || undefined,
      pairing_code: pairingCode.trim() ? pairingCode.trim().toUpperCase() : undefined,
      hdmi_input_id: enableHdmi ? hdmiInputId : 'NONE',
      hdmi_label: hdmiLabel,
      selected_shortcuts: selectedShortcuts,
      custom_settings: {
        ...customSettings,
        uh_number: pmsEnabled ? cleanUh : '',
        guest_name: pmsEnabled ? cleanGuest : '',
        pin_code: cleanPin,
        admin_exit_pin: cleanPin,
        hide_hdmi: !enableHdmi
      }
    });
  };

  const selectedGroupObj = groups.find(g => String(g.id) === String(groupId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
            }}>
              <Tv size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                {tv ? `Configurar: ${tv.name}` : 'Cadastrar Nova Smart TV'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Personalize os vídeos, atalhos de apps, modelo visual e entrada HDMI para esta TV.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Seletor de Tipo de TV: Quarto/UH (PMS) vs Institucional/Reunião (Manual) */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: 6,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8
            }}>
              <button
                type="button"
                onClick={() => setPmsEnabled(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: pmsEnabled ? '1px solid #3b82f6' : '1px solid transparent',
                  background: pmsEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: pmsEnabled ? '#60a5fa' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Building size={16} />
                <span>🏨 TV de Quarto / UH (Opera PMS)</span>
              </button>

              <button
                type="button"
                onClick={() => setPmsEnabled(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: !pmsEnabled ? '1px solid #a855f7' : '1px solid transparent',
                  background: !pmsEnabled ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                  color: !pmsEnabled ? '#c084fc' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Tv size={16} />
                <span>🏢 TV Institucional / Reunião / Setor</span>
              </button>
            </div>

            {/* Banner Explicativo do Modo Selecionado */}
            {!pmsEnabled ? (
              <div style={{
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: '#d8b4fe',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Tv size={16} color="#c084fc" />
                <span>
                  <strong>Modo TV Institucional / Setor:</strong> Não utiliza integração com o Opera. As mensagens de tela configuradas abaixo são <strong>100% fixas</strong> e não serão alteradas por eventos de hóspedes.
                </span>
              </div>
            ) : (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Building size={16} color="#60a5fa" />
                <span>
                  <strong>Modo TV de Quarto / UH:</strong> Integrada ao IFC8/Opera PMS. O nome do hóspede e mensagens de boas-vindas são atualizados em tempo real no Check-in e Check-out.
                </span>
              </div>
            )}

            {/* Seção 1: Identificação Básica & Grupo Herdado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome da TV / Localização *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={pmsEnabled ? "Ex: Quarto 102 - Suíte Luxo" : "Ex: TV Reunião Diretoria / TV Setor RH"}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                  <FolderTree size={14} /> Grupo / Perfil de Herança
                </label>
                <select
                  className="form-input"
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                >
                  <option value="">Nenhum (Configuração Individual)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {selectedGroupObj && (
                  <small style={{ color: '#38bdf8', fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                    ✓ Herda layout, playlist e HDMI de '{selectedGroupObj.name}'
                  </small>
                )}
              </div>

              {pmsEnabled ? (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
                      <Building size={14} /> Unidade Habitacional (UH / Quarto) *
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: 101, 204"
                      value={customSettings.uh_number || ''}
                      onChange={e => setCustomSettings({ ...customSettings, uh_number: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399' }}>
                      <User size={14} /> Nome do Hóspede Atual
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: Diego Reis (ou via PMS Opera)"
                      value={customSettings.guest_name || ''}
                      onChange={e => {
                        const gName = e.target.value;
                        setCustomSettings({
                          ...customSettings,
                          guest_name: gName,
                          welcome_title: gName ? `Sr(a). ${gName}, Bem-vindo(a) ao Fasano` : (customSettings.welcome_title || 'Seja Bem-vindo(a)!')
                        });
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}>
                      Título Fixo da Tela (TV Institucional)
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: Reunião Diretoria Executiva"
                      value={customSettings.welcome_title || ''}
                      onChange={e => setCustomSettings({ ...customSettings, welcome_title: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}>
                      Subtítulo Fixo / Mensagem do Setor
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: Apresentação de Resultados 2026"
                      value={customSettings.welcome_subtitle || ''}
                      onChange={e => setCustomSettings({ ...customSettings, welcome_subtitle: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Seção 2: Vínculo com Dispositivo Físico / Código PIN */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: 14, padding: 14
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={16} /> Dispositivo Físico Vinculado (Android TV)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Código PIN da TV (Exibido na tela)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: TM-3400"
                    value={pairingCode}
                    onChange={e => setPairingCode(e.target.value.toUpperCase())}
                    style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Digite o código de 6 caracteres para vincular esta TV.
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>ID do Aparelho (Device ID)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: TV-D6165722"
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Identificador único gerado pelo APK.
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 3: Layout e Playlist de Vídeos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="#60a5fa" /> Modelo de Layout da Tela
                </label>
                <select 
                  className="form-select"
                  value={layoutId}
                  onChange={e => setLayoutId(e.target.value)}
                >
                  {layouts.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Film size={14} color="#f59e0b" /> Playlist de Vídeos em Loop
                </label>
                <select 
                  className="form-select"
                  value={playlistId}
                  onChange={e => setPlaylistId(e.target.value)}
                >
                  <option value="">Nenhum vídeo em loop (Tela limpa / Fundo escuro)</option>
                  {playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.items?.length || 0} vídeos)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comportamento do Menu na TV (Sempre Visível vs Auto-ocultar) */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={15} color="#60a5fa" /> Menu de Canais & Aplicativos
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {customSettings.auto_hide_dock 
                    ? `Ocultando automaticamente após ${customSettings.auto_hide_seconds || 15}s de inatividade (reaparece ao tocar no controle).` 
                    : 'Menu fixo e sempre visível na TV (recomendado para hotel).'}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', color: '#fff' }}>
                <input 
                  type="checkbox"
                  checked={!customSettings.auto_hide_dock}
                  onChange={e => setCustomSettings({ ...customSettings, auto_hide_dock: !e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <span>Sempre Visível</span>
              </label>
            </div>

            {/* Seção 4: Entrada HDMI (Sky / Receptor) */}
            <div style={{
              background: enableHdmi ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: enableHdmi ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14, padding: 16, transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: enableHdmi ? 14 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tv size={18} color={enableHdmi ? "#ef4444" : "#64748b"} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: enableHdmi ? '#f87171' : '#94a3b8' }}>
                    Entrada HDMI (TV SKY / Receptor)
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox"
                    checked={enableHdmi}
                    onChange={e => setEnableHdmi(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#ef4444', cursor: 'pointer' }}
                  />
                  <span>Habilitar nesta TV</span>
                </label>
              </div>

              {enableHdmi && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Rótulo do Botão na TV</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={hdmiLabel} 
                      onChange={e => setHdmiLabel(e.target.value)} 
                      placeholder="Ex: TV SKY, SKY HD, TV A CABO"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Porta HDMI Conectada</label>
                    <select 
                      className="form-select"
                      value={hdmiInputId}
                      onChange={e => setHdmiInputId(e.target.value)}
                    >
                      <option value="HDMI 1">HDMI 1</option>
                      <option value="HDMI 2">HDMI 2 (Recomendado Sky)</option>
                      <option value="HDMI 3">HDMI 3</option>
                      <option value="HDMI 4">HDMI 4</option>
                      <option value="HW1">HW1 (Passthrough Direto)</option>
                      <option value="HW2">HW2 (Passthrough Direto)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Seção 5: Seleção Individual de Aplicativos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Aplicativos Ativos nesta TV <strong>({selectedShortcuts.length} de {appShortcuts.length})</strong>
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span 
                    style={{ color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                    onClick={handleSelectAll}
                  >
                    Marcar Todos
                  </span>
                  <span style={{ color: '#475569', fontSize: '0.78rem' }}>•</span>
                  <span 
                    style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}
                    onClick={handleDeselectAll}
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
                  const isChecked = selectedShortcuts.includes(sc.id);
                  return (
                    <div 
                      key={sc.id}
                      onClick={() => toggleShortcut(sc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isChecked ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      {isChecked ? <CheckSquare size={17} color="#60a5fa" /> : <Square size={17} color="#64748b" />}
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: isChecked ? '#fff' : '#94a3b8' }}>
                        {sc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seção 6: Mensagem de Boas-Vindas e Wi-Fi com QR Code Upload */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 16
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wifi size={16} color="#34d399" /> Mensagem no Topo da TV & Rede Wi-Fi
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Título de Boas-Vindas</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.welcome_title}
                    onChange={e => setCustomSettings({ ...customSettings, welcome_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Subtítulo</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.welcome_subtitle}
                    onChange={e => setCustomSettings({ ...customSettings, welcome_subtitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Nome da Rede Wi-Fi (SSID)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.wifi_ssid}
                    onChange={e => setCustomSettings({ ...customSettings, wifi_ssid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Senha do Wi-Fi</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.wifi_password}
                    onChange={e => setCustomSettings({ ...customSettings, wifi_password: e.target.value })}
                  />
                </div>
              </div>

              {/* Upload da Imagem do QR Code do Wi-Fi */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <QrCode size={15} color="#34d399" /> Imagem do QR Code de Conexão Wi-Fi
                  </label>
                  {customSettings.wifi_qrcode_url && (
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
                  {customSettings.wifi_qrcode_url ? (
                    <div style={{
                      width: 72, height: 72, borderRadius: 10, background: '#fff',
                      padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid #34d399'
                    }}>
                      <img 
                        src={customSettings.wifi_qrcode_url} 
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
                      <Upload size={14} /> {uploadingQr ? 'Enviando imagem...' : (customSettings.wifi_qrcode_url ? 'Trocar Imagem do QR Code' : 'Fazer Upload da Imagem do QR Code')}
                    </button>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Envie a imagem do QR Code (.png ou .jpg). Ela será exibida no topo da tela da TV ao lado da rede Wi-Fi.
                    </div>
                  </div>
                </div>

                {/* Ajuste do Tamanho do QR Code na TV */}
                {customSettings.wifi_qrcode_url && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sliders size={14} color="#34d399" /> Tamanho do QR Code na TV
                      </label>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.12)', padding: '2px 8px', borderRadius: 6 }}>
                        {customSettings.wifi_qr_size || 110} px
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input 
                        type="range"
                        min="50"
                        max="220"
                        step="10"
                        value={customSettings.wifi_qr_size || 110}
                        onChange={e => setCustomSettings({ ...customSettings, wifi_qr_size: parseInt(e.target.value) })}
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
                          onClick={() => setCustomSettings({ ...customSettings, wifi_qr_size: preset.size })}
                          style={{
                            padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer',
                            background: (customSettings.wifi_qr_size || 110) === preset.size ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: (customSettings.wifi_qr_size || 110) === preset.size ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: (customSettings.wifi_qr_size || 110) === preset.size ? '#34d399' : '#94a3b8',
                            fontWeight: 600
                          }}
                        >
                          {preset.label} ({preset.size}px)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Seção 7: Segurança & Modo Kiosk (Senha de Saída na TV) */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 14, padding: 14
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f87171', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={16} color="#f87171" /> Senha de Saída do App na TV (Modo Kiosk)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Impede que hóspedes fechem o app Fasano SMARTTV ou acessem a tela original da TV. Para fechar o app na TV ou abrir ajustes, é obrigatório digitar este PIN.
              </div>
              <div style={{ maxWidth: 240 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>PIN de Saída (4 a 6 dígitos)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  maxLength={6}
                  placeholder="Ex: 1234"
                  value={customSettings.admin_exit_pin || '1234'}
                  onChange={e => setCustomSettings({ ...customSettings, admin_exit_pin: e.target.value.replace(/\D/g, '') })}
                  style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.25em', fontSize: '1.2rem', textAlign: 'center' }}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={16} /> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
