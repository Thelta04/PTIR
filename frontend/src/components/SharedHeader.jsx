import React from 'react';
import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SharedHeader({ title = 'TUXY', subtitle, user, onMenuClick, onProfileClick, navigateTo = '/' }) {
  const navigate = useNavigate();
  return (
    <header className="client-header">
      <button className="menu-btn" aria-label="Abrir menu" onClick={onMenuClick}>
        <Menu size={24} color="#000" aria-hidden="true" />
      </button>

      <div className="client-brand" onClick={() => navigate(navigateTo)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '8px', height: '40px', alignItems: 'center' }}>
          <img src="/icon_small.png" alt="TUXY Icon" style={{ width: '28px', height: '28px' }} />
          <h1 className="client-brand-name" style={{ margin: 0, lineHeight: 1 }}>{title}</h1>
        </div>
        {subtitle && (
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#666', lineHeight: 1, height: '14px', display: 'flex', marginTop: '4px' }}>
            {subtitle}
          </span>
        )}
      </div>

      <div
        className="user-name-container"
        onClick={onProfileClick}
        style={{ cursor: 'pointer', gap: '4px' }}
      >
        <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
          <img
            src={`/PFPs/${user?.profile_pic || 1}.jpg`}
            alt="Profile"
            className="user-pfp-small"
            style={{ margin: 0 }}
          />
        </div>
        <span className="user-name-text" style={{ fontSize: '0.85rem', fontWeight: 'bold', lineHeight: 1, height: '14px', display: 'flex', alignItems: 'center', color: '#000' }}>
          {user?.name?.split(' ')[0]}
        </span>
      </div>
    </header>
  );
}
