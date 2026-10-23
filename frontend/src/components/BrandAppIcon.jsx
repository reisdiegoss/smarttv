import React from 'react';
import { Tv, Play, Film, MonitorPlay } from 'lucide-react';

/**
 * Renderiza os logotipos e identidades visuais oficiais dos aplicativos
 * para refletir exatamente os banners/ícones nativos que já existem na TV.
 */
export default function BrandAppIcon({ name, packageName, iconUrl, isHdmi, isFocused, size = 34 }) {
  if (iconUrl) {
    return (
      <img 
        src={iconUrl} 
        alt={name || 'App Icon'} 
        style={{ 
          width: size, 
          height: size, 
          objectFit: 'contain', 
          background: 'transparent',
          display: 'block' 
        }} 
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  const norm = (name || '').toLowerCase();
  const pkg = (packageName || '').toLowerCase();

  // SKY TV (HDMI)
  if (isHdmi || norm.includes('sky')) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg width={size} height={Math.round(size * 0.76)} viewBox="0 0 36 28" fill="none">
          <rect width="36" height="28" rx="6" fill="#E50914" />
          <path d="M10 8H8C6.9 8 6 8.9 6 10V18C6 19.1 6.9 20 8 20H10V18H8V10H10V8Z" fill="#FFF"/>
          <path d="M18 8L15 14L12 8H10L14 15V20H16V15L20 8H18Z" fill="#FFF"/>
          <path d="M28 8H22V20H24V15H28C29.1 15 30 14.1 30 13V10C30 8.9 29.1 8 28 8ZM28 13H24V10H28V13Z" fill="#FFF"/>
        </svg>
      </div>
    );
  }

  // NETFLIX
  if (norm.includes('netflix') || pkg.includes('netflix')) {
    return (
      <svg width="28" height="32" viewBox="0 0 28 36" fill="none">
        <path d="M4 0H9V36H4V0Z" fill="#E50914" />
        <path d="M19 0H24V36H19V0Z" fill="#E50914" />
        <path d="M4 0H9L24 36H19L4 0Z" fill="#B81D24" />
        <path d="M4 0H9L19 25L14 25L4 0Z" fill="#E50914" opacity="0.9" />
      </svg>
    );
  }

  // YOUTUBE
  if (norm.includes('youtube') || pkg.includes('youtube')) {
    return (
      <svg width="36" height="26" viewBox="0 0 36 26" fill="none">
        <path d="M35.1 3.9C34.7 2.4 33.6 1.3 32.1 0.9C29.4 0.2 18 0.2 18 0.2C18 0.2 6.6 0.2 3.9 0.9C2.4 1.3 1.3 2.4 0.9 3.9C0.2 6.6 0.2 13 0.2 13C0.2 13 0.2 19.4 0.9 22.1C1.3 23.6 2.4 24.7 3.9 25.1C6.6 25.8 18 25.8 18 25.8C18 25.8 29.4 25.8 32.1 25.1C33.6 24.7 34.7 23.6 35.1 22.1C35.8 19.4 35.8 13 35.8 13C35.8 13 35.8 6.6 35.1 3.9Z" fill="#FF0000" />
        <path d="M14.5 18.5L23.8 13L14.5 7.5V18.5Z" fill="#FFFFFF" />
      </svg>
    );
  }

  // DISNEY+
  if (norm.includes('disney') || pkg.includes('disney')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="38" height="24" viewBox="0 0 44 26" fill="none">
          <path d="M14.5 5C13.2 5 12 5.5 11 6.5C10 7.5 9.5 8.7 9.5 10C9.5 12 10.8 13.5 13 14C11.5 14.5 10.5 15.5 10.5 17C10.5 18.5 11.5 19.5 13 20C10 20 8 18 8 15C8 11.5 10.5 8.5 14.5 8.5C16 8.5 17.5 9 18.5 10L17 12C16.5 11.2 15.5 11 14.5 11C13.2 11 12.2 11.8 12.2 13C12.2 14.2 13.2 15 14.5 15C16 15 17.2 14.2 17.5 13H15V11H19.5V17C18 19 16 20 14 20" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M22 6V20M20 9L24 9" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/>
          {/* Disney+ Swoosh Arch */}
          <path d="M2 22C10 12 25 3 42 10" stroke="#113CCF" strokeWidth="3" strokeLinecap="round" />
          <path d="M2 22C10 12 25 3 42 10" stroke="#00D6FF" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M38 12V20M34 16H42" stroke="#00D6FF" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // PRIME VIDEO
  if (norm.includes('prime') || norm.includes('amazon') || pkg.includes('amazon')) {
    return (
      <svg width="34" height="26" viewBox="0 0 36 28" fill="none">
        <rect width="36" height="28" rx="6" fill="#00A8E1" />
        <path d="M8 12C8 9.8 9.8 8 12 8C13.2 8 14.2 8.5 15 9.3V8.2H17V17H15V16C14.2 16.8 13.2 17.2 12 17.2C9.8 17.2 8 15.4 8 13.2V12ZM15 12.6C15 11.2 13.8 10 12.4 10C11 10 9.8 11.2 9.8 12.6C9.8 14 11 15.2 12.4 15.2C13.8 15.2 15 14 15 12.6Z" fill="#FFF"/>
        {/* Amazon Smile Curve */}
        <path d="M10 21C14 23 22 23 26 19.5" stroke="#FFA724" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M25 18L26.5 20L28 18.5" fill="#FFA724"/>
      </svg>
    );
  }

  // GLOBOPLAY
  if (norm.includes('globo') || pkg.includes('globo')) {
    return (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" fill="#FB0166" />
        <circle cx="16" cy="16" r="10" fill="#FF5E00" />
        <circle cx="16" cy="16" r="6" fill="#FFCE00" />
        <circle cx="16" cy="16" r="3" fill="#FFF" />
      </svg>
    );
  }

  // MAX (HBO MAX)
  if (norm.includes('max') || pkg.includes('wbd')) {
    return (
      <div style={{
        background: '#002BE7', borderRadius: 8, padding: '4px 8px',
        fontWeight: 900, letterSpacing: -0.5, fontSize: '1.05rem', color: '#FFF',
        fontFamily: 'sans-serif', fontStyle: 'italic'
      }}>
        max
      </div>
    );
  }

  // SPOTIFY
  if (norm.includes('spotify') || pkg.includes('spotify')) {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="14" fill="#1ED760" />
        <path d="M19.5 20.2C19.2 20.7 18.6 20.9 18.1 20.6C15 18.7 11.2 18.3 6.6 19.3C6 19.4 5.5 19 5.4 18.5C5.3 17.9 5.7 17.4 6.2 17.3C11.3 16.1 15.5 16.6 19 18.7C19.5 19 19.7 19.6 19.5 20.2ZM21 16.5C20.6 17.1 19.9 17.3 19.3 16.9C15.8 14.8 10.5 14.1 6.3 15.4C5.6 15.6 4.9 15.2 4.7 14.5C4.5 13.8 4.9 13.1 5.6 12.9C10.5 11.4 16.3 12.1 20.4 14.6C21 14.9 21.2 15.7 21 16.5ZM21.2 12.6C17 10.1 9.9 9.8 5.8 11.1C5 11.3 4.2 10.9 3.9 10.1C3.7 9.3 4.1 8.5 4.9 8.2C9.7 6.8 17.6 7.1 22.5 10C23.2 10.4 23.4 11.4 23 12.1C22.6 12.8 21.8 13 21.2 12.6Z" fill="#000" />
      </svg>
    );
  }

  // Fallback TV App
  return <Tv size={26} color={isFocused ? '#FFF' : '#60a5fa'} />;
}
