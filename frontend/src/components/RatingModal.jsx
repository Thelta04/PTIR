import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import './RatingModal.css';

export default function RatingModal({ isOpen, onClose, onRate, driverName }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="rating-modal-overlay">
        <motion.div 
          className="rating-modal-content"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
        >
          <button className="rating-modal-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="rating-modal-header">
            <div className="rating-success-icon">✨</div>
            <h2>Como foi a sua viagem?</h2>
            <p>Avalie a sua experiência com o motorista <strong>{driverName}</strong></p>
          </div>

          <div className="star-rating-container">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className="star-btn"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
              >
                <Star
                  size={40}
                  fill={(hover || rating) >= star ? "#f1af3d" : "none"}
                  color={(hover || rating) >= star ? "#f1af3d" : "#ccc"}
                  strokeWidth={2}
                />
              </button>
            ))}
          </div>

          <div className="rating-modal-actions">
            <button 
              className="rating-submit-btn" 
              onClick={() => onRate(rating)}
            >
              {rating > 0 ? 'Submeter Avaliação' : 'Pular'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
