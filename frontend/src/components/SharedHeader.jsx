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

      <div className="client-brand" onClick={() => navigate(navigateTo)}>
        <div className="client-brand-main">
          <img src="/icon_small.png" alt="TUXY Icon" className="client-brand-icon" />
          <h1 className="client-brand-name">{title}</h1>
        </div>
        {subtitle && (
          <span className="client-brand-subtitle">
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
