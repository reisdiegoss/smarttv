import React, { useState, useRef } from 'react';
import { 
  Tv, Plus, Edit2, Trash2, Check, X, ExternalLink, 
  Layers, Sliders, Smartphone, Image as ImageIcon, Sparkles,
  Upload, Palette
} from 'lucide-react';
import BrandAppIcon from './BrandAppIcon';

const PRESET_APPS = [
  { name: 'Netflix', package_name: 'com.netflix.ninja', icon_name: 'PlaySquare' },
  { name: 'YouTube', package_name: 'com.google.android.youtube.tv', icon_name: 'Youtube' },
  { name: 'Prime Video', package_name: 'com.amazon.amazonvideo.livingroom', icon_name: 'Film' },
  { name: 'Disney+', package_name: 'com.disney.disneyplus', icon_name: 'Sparkles' },
  { name: 'Globoplay', package_name: 'com.globo.globotv', icon_name: 'Tv2' },
  { name: 'Max', package_name: 'com.wbd.stream', icon_name: 'Clapperboard' },
  { name: 'Spotify', package_name: 'com.spotify.tv.android', icon_name: 'Music' },
  { name: 'Apple TV', package_name: 'com.apple.atve.androidtv.appletv', icon_name: 'Film' },
  { name: 'Pluto TV', package_name: 'tv.pluto.android', icon_name: 'Tv' },
  { name: 'Paramount+', package_name: 'com.cbs.app', icon_name: 'Film' },
  { name: 'Star+', package_name: 'com.disney.starplus', icon_name: 'Sparkles' },
  { name: 'TV SKY (HDMI)', package_name: 'action.switch_hdmi', icon_name: 'Tv', is_hdmi: true }
];

export default function ShortcutsView({ shortcuts = [], onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPackage, setFormPackage] = useState('');
  const [formIconName, setFormIconName] = useState('Tv');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [formBgColor, setFormBgColor] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formIsHdmi, setFormIsHdmi] = useState(false);
  const [formIsSystem, setFormIsSystem] = useState(false);

  const openCreateModal = () => {
    setEditingShortcut(null);
    setFormName('');
    setFormPackage('');
    setFormIconName('Tv');
    setFormIconUrl('');
    setFormBgColor('');
    setFormOrder(shortcuts.length + 1);
    setFormIsHdmi(false);
    setFormIsSystem(false);
    setIsModalOpen(true);
  };

  const openEditModal = (sc) => {
    setEditingShortcut(sc);
    setFormName(sc.name || '');
    setFormPackage(sc.package_name || '');
    setFormIconName(sc.icon_name || 'Tv');
    setFormIconUrl(sc.icon_url || '');
    setFormBgColor(sc.background_color || '');
    setFormOrder(sc.default_order ?? 0);
    setFormIsHdmi(Boolean(sc.is_hdmi));
    setFormIsSystem(Boolean(sc.is_system_app));
    setIsModalOpen(true);
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Por favor, selecione uma imagem PNG, SVG, WebP ou JPEG.');
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Falha ao enviar imagem');
      }

      const data = await res.json();
      if (data.url) {
        setFormIconUrl(data.url);
      }
    } catch (err) {
      alert(`Erro no upload: ${err.message}`);
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyPreset = (preset) => {
    setFormName(preset.name);
    setFormPackage(preset.package_name);
    setFormIconName(preset.icon_name);
    setFormIsHdmi(Boolean(preset.is_hdmi));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor, informe o nome do aplicativo / atalho.');
      return;
    }
    if (!formPackage.trim()) {
      alert('Por favor, informe o nome do pacote Android (Package Name).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        package_name: formPackage.trim(),
        icon_name: formIconName.trim() || 'Tv',
        icon_url: formIconUrl.trim() || null,
        background_color: formBgColor.trim() || null,
        default_order: parseInt(formOrder) || 0,
        is_hdmi: formIsHdmi,
        is_system_app: formIsSystem
      };

      if (editingShortcut?.id) {
        // Update
        const res = await fetch(`/api/shortcuts/${editingShortcut.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha ao atualizar atalho');
      } else {
        // Create
        const res = await fetch('/api/shortcuts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha ao criar atalho');
      }

      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sc) => {
    if (!confirm(`Deseja realmente remover o aplicativo/atalho "${sc.name}"?`)) return;
    try {
      const res = await fetch(`/api/shortcuts/${sc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir atalho');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Erro ao remover: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={24} color="#3b82f6" /> Gestão de Aplicativos & Atalhos da Dock
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0, maxWidth: 750 }}>
            Gerencie os aplicativos exibidos na TV: faça upload de logos PNG/SVG transparentes, customize as cores de fundo, edite os nomes e defina a ordem de exibição na barra inferior.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={openCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
        >
          <Plus size={18} /> Novo Aplicativo na TV
        </button>
      </div>

      {/* Grid of Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
        {shortcuts.map((sc) => (
          <div 
            key={sc.id} 
            className="glass-card" 
            style={{ 
              padding: 20, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.75)',
              border: sc.is_hdmi ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Icon Container with Transparency & Custom Background */}
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: sc.background_color 
                  ? sc.background_color 
                  : (sc.is_hdmi ? 'rgba(239, 68, 68, 0.25)' : 'rgba(30, 41, 59, 0.8)'),
                border: sc.is_hdmi ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                overflow: 'hidden'
              }}>
                <BrandAppIcon 
                  name={sc.name} 
                  packageName={sc.package_name} 
                  iconUrl={sc.icon_url} 
                  isHdmi={sc.is_hdmi} 
                  size={36} 
                />
              </div>

              {/* Info */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 700 }}>
                    {sc.name}
                  </h4>
                  {sc.is_hdmi && (
                    <span style={{ fontSize: '0.68rem', background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      HDMI SKY
                    </span>
                  )}
                  {sc.is_system_app && !sc.is_hdmi && (
                    <span style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                      Sistema
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all' }}>
                  Pacote: <code style={{ color: '#93c5fd', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>{sc.package_name}</code>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: '0.72rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span>Ordem: <strong>#{sc.default_order}</strong></span>
                  {sc.icon_url && <span style={{ color: '#34d399' }}>• Imagem Custom</span>}
                  {sc.background_color && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      • Cor Fundo: 
                      <span style={{ 
                        width: 12, height: 12, borderRadius: 3, 
                        background: sc.background_color, 
                        border: '1px solid rgba(255,255,255,0.4)',
                        display: 'inline-block' 
                      }} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openEditModal(sc)}
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit2 size={13} /> Editar
              </button>
              {!sc.is_system_app && !sc.is_hdmi && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDelete(sc)}
                  style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Layers size={18} color="#3b82f6" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {editingShortcut ? 'Editar Aplicativo / Atalho' : 'Cadastrar Novo Aplicativo na TV'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Configurações do botão e mapeamento de pacote Android
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setIsModalOpen(false)} 
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              {/* Atalhos Rápidos de Apps Conhecidos */}
              {!editingShortcut && (
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: 12, borderRadius: 10, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#93c5fd', display: 'block', marginBottom: 8 }}>
                    Preenchimento Rápido com Apps Populares:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PRESET_APPS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        style={{
                          padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#fff', cursor: 'pointer'
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nome do Aplicativo (Texto na Dock) */}
              <div>
                <label className="form-label">Nome de Exibição do Botão (Texto na Barra) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  placeholder="Ex: Netflix, Globoplay, IPTV Hotel, TV SKY"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Este é o texto legível que aparece abaixo do ícone na TV.
                </span>
              </div>

              {/* Pacote Android */}
              <div>
                <label className="form-label">Nome do Pacote Android (Package Name) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  placeholder="Ex: com.netflix.ninja ou action.switch_hdmi"
                  value={formPackage}
                  onChange={e => setFormPackage(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  O Android TV usa esse pacote para abrir o app ao clicar com o controle remoto.
                </span>
              </div>

              {/* Upload e URL de Imagem / Logo Customizado */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <ImageIcon size={14} color="#38bdf8" /> Ícone / Logotipo do Aplicativo
                  </label>
                  {formIconUrl && (
                    <button
                      type="button"
                      onClick={() => setFormIconUrl('')}
                      style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                    >
                      Remover imagem
                    </button>
                  )}
                </div>

                {/* Hidden File Input */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept="image/png,image/svg+xml,image/webp,image/jpeg,image/jpg"
                  onChange={handleIconUpload}
                />

                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingIcon}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      background: 'rgba(59, 130, 246, 0.12)',
                      borderColor: 'rgba(59, 130, 246, 0.35)',
                      color: '#60a5fa',
                      fontSize: '0.82rem',
                      padding: '8px 14px',
                      cursor: 'pointer'
                    }}
                  >
                    <Upload size={15} />
                    {uploadingIcon ? 'Enviando imagem...' : 'Fazer Upload de Imagem (PNG, SVG, WebP)'}
                  </button>
                </div>

                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ou cole a URL direta (ex: /api/media/image/logo.png)"
                  value={formIconUrl}
                  onChange={e => setFormIconUrl(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Suporte total a transparência PNG/SVG (sem quadrado branco atrás).
                </span>
              </div>

              {/* Cor de Fundo do Botão (Background Color) */}
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Palette size={14} color="#a78bfa" /> Cor de Fundo do Botão no Dock
                </label>

                {/* Presets Rápidos */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {[
                    { label: 'Transparente Escuro', value: 'rgba(0, 0, 0, 0.45)', color: 'rgba(0, 0, 0, 0.6)' },
                    { label: 'Totalmente Transparente', value: 'transparent', color: 'rgba(255, 255, 255, 0.1)' },
                    { label: 'Azul Fasano', value: '#1e3a8a', color: '#1e3a8a' },
                    { label: 'Vermelho Netflix', value: '#E50914', color: '#E50914' },
                    { label: 'Verde Spotify', value: '#1ED760', color: '#1ED760' },
                    { label: 'Azul Disney/Prime', value: '#0284c7', color: '#0284c7' },
                    { label: 'Dourado Hotel', value: '#d97706', color: '#d97706' },
                    { label: 'Preto Puro', value: '#000000', color: '#000000' }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormBgColor(preset.value)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        borderRadius: 6,
                        border: formBgColor === preset.value ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                        background: preset.color,
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={formBgColor.startsWith('#') && formBgColor.length === 7 ? formBgColor : '#1e3a8a'}
                    onChange={e => setFormBgColor(e.target.value)}
                    style={{
                      width: 42,
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'none',
                      cursor: 'pointer',
                      padding: 2
                    }}
                    title="Seletor de cor visual"
                  />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: #E50914, rgba(0,0,0,0.45) ou transparent"
                    value={formBgColor}
                    onChange={e => setFormBgColor(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                  {formBgColor && (
                    <button
                      type="button"
                      onClick={() => setFormBgColor('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Padrão
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Selecione a cor de fundo desejada para preencher o botão quando a imagem tiver fundo transparente.
                </span>
              </div>

              {/* Ordem de Exibição */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label">Ordem na Barra (1, 2, 3...)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="1"
                    max="99"
                    value={formOrder}
                    onChange={e => setFormOrder(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, paddingTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8rem', color: '#fff' }}>
                    <input 
                      type="checkbox"
                      checked={formIsHdmi}
                      onChange={e => setFormIsHdmi(e.target.checked)}
                      style={{ accentColor: '#ef4444' }}
                    />
                    <span>Atalho HDMI SKY</span>
                  </label>
                </div>
              </div>

              {/* Preview do Ícone e Cor de Fundo */}
              <div style={{ 
                background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 16
              }}>
                {/* Visual Checkered Backdrop to prove PNG transparency */}
                <div style={{
                  padding: 4,
                  borderRadius: 16,
                  backgroundImage: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 12px 12px',
                  display: 'inline-block'
                }}>
                  <div style={{
                    width: 58, height: 58, borderRadius: 14,
                    background: formBgColor 
                      ? formBgColor 
                      : (formIsHdmi ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 0, 0, 0.45)'),
                    border: '1.5px solid rgba(255, 255, 255, 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                    overflow: 'hidden'
                  }}>
                    <BrandAppIcon 
                      name={formName} 
                      packageName={formPackage} 
                      iconUrl={formIconUrl} 
                      isHdmi={formIsHdmi} 
                      size={38} 
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>
                    Pré-visualização do Botão
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formName || 'Nome do Aplicativo'}
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Fundo: <code style={{ color: '#93c5fd' }}>{formBgColor || 'rgba(0, 0, 0, 0.45) (Padrão)'}</code>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 8 }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={16} /> {saving ? 'Salvando...' : (editingShortcut ? 'Salvar Alterações' : 'Cadastrar Aplicativo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
