import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ConfirmationModal.css';

export default function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  hideCancel = false
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-portal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div 
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <h2 id="modal-title" className="modal-title">{title}</h2>
            <div className="modal-message">{message}</div>
            <div className="modal-actions">
              {!hideCancel && (
                <button className="modal-btn modal-btn--cancel" onClick={onCancel}>
                  {cancelText}
                </button>
              )}
              <button className="modal-btn modal-btn--confirm" onClick={onConfirm}>
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
