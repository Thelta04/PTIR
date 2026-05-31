import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './PFPSelector.css';

const PFPS = Array.from({ length: 12 }, (_, i) => i + 1);

export function PFPGrid({ selectedPfp, onSelect }) {
  return (
    <div className="pfp-grid-circular">
      {PFPS.map((id) => (
        <motion.div
          key={id}
          className={`pfp-option ${selectedPfp === id ? 'selected' : ''}`}
          onClick={() => onSelect(id)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <img src={`/PFPs/${id}.jpg`} alt={`PFP ${id}`} />
        </motion.div>
      ))}
    </div>
  );
}

export default function PFPSelector({ selectedPfp, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pfp-selector-container">
      <div className="pfp-current-wrapper" onClick={() => setIsOpen(true)}>
        <img 
          src={`/PFPs/${selectedPfp}.jpg`} 
          alt="Selected PFP" 
          className="pfp-current-img"
        />
        <div className="pfp-edit-overlay">
          <span>Alterar</span>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="pfp-modal-overlay" onClick={() => setIsOpen(false)}>
            <motion.div 
              className="pfp-modal-content"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Escolha a sua Foto de Perfil</h3>
              <PFPGrid 
                selectedPfp={selectedPfp} 
                onSelect={(id) => {
                  onSelect(id);
                  setIsOpen(false);
                }} 
              />
              <button className="pfp-modal-close" onClick={() => setIsOpen(false)}>
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
