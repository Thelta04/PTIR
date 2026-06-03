import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

export default function SharedDrawer({ isOpen, onClose, onLogout, children, title = 'Menu' }) {
  if (!isOpen) return null;
  return (
    <>
      <motion.div
        className="drawer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="drawer-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
      >
        <div className="drawer-header">
          <h2 id="drawer-title" className="drawer-title" style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h2>
          <button className="drawer-close" aria-label="Fechar menu" onClick={onClose}>
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
        </div>

        <nav className="drawer-nav">
          {children}
        </nav>

        <div className="drawer-footer">
          <button className="drawer-logout" onClick={onLogout}>
            Terminar Sessão
          </button>
        </div>
      </motion.aside>
    </>
  );
}
