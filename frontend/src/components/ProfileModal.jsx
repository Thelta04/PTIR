import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, ChevronLeft, Calendar, Info, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PFPGrid } from './PFPSelector';
import './ProfileModal.css';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateUserPfp } = useAuth();
  const [showPfpGrid, setShowPfpGrid] = useState(false);

  if (!user) return null;

  const handlePfpSelect = async (id) => {
    try {
      await updateUserPfp(id);
      setShowPfpGrid(false);
    } catch (err) {
      alert('Erro ao atualizar foto de perfil');
    }
  };

  const handleClose = () => {
    setShowPfpGrid(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="profile-modal-portal">
          <motion.div 
            className="profile-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div 
            className="profile-modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
          >
            {!showPfpGrid ? (
              <>
                <button className="profile-modal-close" onClick={handleClose}>
                  <X size={24} />
                </button>

                <div className="profile-header-info">
                  <div className="profile-pfp-wrapper" onClick={() => setShowPfpGrid(true)}>
                    <img 
                      src={`/PFPs/${user.profile_pic || 1}.jpg`} 
                      alt="Profile" 
                      className="profile-pfp-large"
                    />
                    <div className="profile-pfp-edit-badge">
                      <span>Alterar</span>
                    </div>
                  </div>
                  <h2 className="profile-name">{user.name}</h2>
                  <span className="profile-role-badge">{user.type === 'DRIVER' ? 'Motorista' : 'Cliente'}</span>
                </div>

                <div className="profile-details-list">
                  <div className="profile-detail-item">
                    <Mail size={18} className="profile-detail-icon" />
                    <div className="profile-detail-text">
                      <label>Email</label>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className="profile-detail-item">
                    <Info size={18} className="profile-detail-icon" />
                    <div className="profile-detail-text">
                      <label>Género</label>
                      <span>{user.gender === 'Male' ? 'Masculino' : user.gender === 'Female' ? 'Feminino' : 'Outro'}</span>
                    </div>
                  </div>
                  {user.birth_year && (
                    <div className="profile-detail-item">
                      <Calendar size={18} className="profile-detail-icon" />
                      <div className="profile-detail-text">
                        <label>Ano de Nascimento</label>
                        <span>{user.birth_year}</span>
                      </div>
                    </div>
                  )}
                  <div className="profile-detail-item">
                    <Shield size={18} className="profile-detail-icon" />
                    <div className="profile-detail-text">
                      <label>Tipo de Conta</label>
                      <span>{user.type === 'DRIVER' ? 'Motorista' : 'Cliente'}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="profile-pfp-selection-view">
                <div className="selection-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '10px' }}>
                  <button className="back-btn-simple" onClick={() => setShowPfpGrid(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <ChevronLeft size={24} />
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Escolher Foto</h3>
                </div>
                
                <PFPGrid 
                  selectedPfp={user.profile_pic || 1} 
                  onSelect={handlePfpSelect} 
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
