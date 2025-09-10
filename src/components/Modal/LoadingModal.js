import React from 'react';
import './Modal.css';

const LoadingModal = ({ isOpen, message = "Processing..." }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content loading-modal">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <h2 className="modal-title">{message}</h2>
        <p className="modal-subtitle">Please wait while we process your import...</p>
      </div>
    </div>
  );
};

export default LoadingModal;
