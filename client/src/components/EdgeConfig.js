import React, { useState, useEffect } from 'react';
import '../modal.css';

const EdgeConfig = ({ edge, onClose, onSave }) => {
  const [operator, setOperator] = useState('AND');
  
  useEffect(() => {
    if (edge && edge.data) {
      setOperator(edge.data.operator || 'AND');
    }
  }, [edge]);

  const handleSave = () => {
    onSave(edge.id, { operator });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Configure Edge</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Edge ID:</label>
            <input type="text" value={edge.id} disabled className="read-only" />
          </div>
          <div className="form-group">
            <label>From:</label>
            <input type="text" value={edge.source} disabled className="read-only" />
          </div>
          <div className="form-group">
            <label>To:</label>
            <input type="text" value={edge.target} disabled className="read-only" />
          </div>
          <div className="form-group">
            <label>Operator:</label>
            <select 
              value={operator} 
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} className="primary-button">Save</button>
        </div>
      </div>
    </div>
  );
};

export default EdgeConfig; 