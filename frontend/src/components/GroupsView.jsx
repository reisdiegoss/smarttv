import React, { useState } from 'react';
import { 
  FolderTree, Plus, Edit, Trash2, Users, Layers, Film, 
  Tv, CheckSquare, Square, Save, X, Sparkles, Key, Radio, Wifi
} from 'lucide-react';

export default function GroupsView({ 
  groups = [], 
  tvs = [], 
  layouts = [], 
  playlists = [], 
  shortcuts = [], 
  onRefresh, 
  fetchHeaders 
}) {
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
    wifi_ssid: 'Fasano-Guest',
    wifi_password: 'fasanobemvindo',
    show_clock: true,
    show_weather: true,
    weather_city: 'São Paulo',
    auto_hide_dock: true,
    auto_hide_seconds: 15,
    volume_limit: 80,
    pin_code: '0000'
  });

  const appShortcuts = shortcuts.filter(s => !s.is_hdmi);

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
      wifi_ssid: 'Fasano-Guest',
      wifi_password: 'fasanobemvindo',
      show_clock: true,
      show_weather: true,
      weather_city: 'São Paulo',
      auto_hide_dock: true,
      auto_hide_seconds: 15,
      volume_limit: 80,
      pin_code: '0000'
    });
    setIsModalOpen(true);
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
    setFormCustomSettings({
      welcome_title: group.custom_settings?.welcome_title || 'Seja Bem-vindo(a)!',
      welcome_subtitle: group.custom_settings?.welcome_subtitle || 'Aproveite a sua estadia.',
      wifi_ssid: group.custom_settings?.wifi_ssid || '',
      wifi_password: group.custom_settings?.wifi_password || '',
      show_clock: group.custom_settings?.show_clock ?? true,
      show_weather: group.custom_settings?.show_weather ?? true,
      weather_city: group.custom_settings?.weather_city || 'São Paulo',
      auto_hide_dock: group.custom_settings?.auto_hide_dock ?? true,
      auto_hide_seconds: group.custom_settings?.auto_hide_seconds || 15,
      volume_limit: group.custom_settings?.volume_limit || 80,
      pin_code: group.custom_settings?.pin_code || '0000',
      ...(group.custom_settings || {})
    });
    setIsModalOpen(true);
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

      {/* Modal de Criação / Edição de Grupo */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderTree size={20} color="var(--primary)" />
                {selectedGroup ? `Editar Grupo: ${selectedGroup.name}` : 'Novo Grupo de TVs'}
              </h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Nome do Grupo *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formName} 
                    onChange={e => setFormName(e.target.value)} 
                    placeholder="Ex: TV Lobby, TV Quartos Standard, TV Vista Mar"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Descrição do Grupo</label>
                  <textarea 
                    className="form-control" 
                    rows={2}
                    value={formDescription} 
                    onChange={e => setFormDescription(e.target.value)} 
                    placeholder="Ex: Televisores das suítes de frente para o mar com serviços VIP."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Modelo de Layout Padrão</label>
                    <select 
                      className="form-control"
                      value={formLayoutId}
                      onChange={e => setFormLayoutId(e.target.value)}
                    >
                      {layouts.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Playlist Padrão</label>
                    <select 
                      className="form-control"
                      value={formPlaylistId}
                      onChange={e => setFormPlaylistId(e.target.value)}
                    >
                      {playlists.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Entrada HDMI Padrão</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formHdmiInputId} 
                      onChange={e => setFormHdmiInputId(e.target.value)} 
                      placeholder="Ex: HDMI 1"
                    />
                  </div>

                  <div>
                    <label className="form-label">Nome do Botão HDMI</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formHdmiLabel} 
                      onChange={e => setFormHdmiLabel(e.target.value)} 
                      placeholder="Ex: TV SKY"
                    />
                  </div>
                </div>

                {/* Senha PIN de saída e Wi-Fi */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Senha PIN de Saída do App *</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      className="form-control" 
                      value={formCustomSettings.pin_code || ''} 
                      onChange={e => setFormCustomSettings({ ...formCustomSettings, pin_code: e.target.value })} 
                      placeholder="Ex: 0000"
                      title="Senha solicitada no app para fechar e voltar à launcher original"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                      Padrão de senha herdado pelas TVs do grupo.
                    </small>
                  </div>

                  <div>
                    <label className="form-label">Rede Wi-Fi (SSID)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formCustomSettings.wifi_ssid || ''} 
                      onChange={e => setFormCustomSettings({ ...formCustomSettings, wifi_ssid: e.target.value })} 
                      placeholder="Ex: Fasano-Guest"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Senha do Wi-Fi</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formCustomSettings.wifi_password || ''} 
                      onChange={e => setFormCustomSettings({ ...formCustomSettings, wifi_password: e.target.value })} 
                      placeholder="Ex: fasanobemvindo"
                    />
                  </div>

                  <div>
                    <label className="form-label">Cidade do Clima</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formCustomSettings.weather_city || ''} 
                      onChange={e => setFormCustomSettings({ ...formCustomSettings, weather_city: e.target.value })} 
                      placeholder="Ex: Salvador ou São Paulo"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Título de Boas-vindas Padrão</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formCustomSettings.welcome_title || ''} 
                    onChange={e => setFormCustomSettings({ ...formCustomSettings, welcome_title: e.target.value })} 
                    placeholder="Ex: Seja Bem-vindo(a) ao Fasano"
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                    Se a TV tiver hóspede vinculado pelo PMS IFC8, ela personalizará automaticamente com o nome dele.
                  </small>
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
