import React, { useState, useEffect } from 'react';
import '../modal.css';

const NodeConfig = ({ node, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [nodeConfig, setNodeConfig] = useState({});
  
  useEffect(() => {
    // Initialize form with node data
    if (node && node.data) {
      setName(node.data.metadata?.name || '');
      setNodeConfig(node.data.metadata || {});
    }
  }, [node]);

  const handleSave = () => {
    const updatedMetadata = {
      ...nodeConfig,
      name: name
    };
    
    onSave(node.id, updatedMetadata);
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Configure Node</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Node ID:</label>
            <input type="text" value={node.id} disabled className="read-only" />
          </div>
          <div className="form-group">
            <label>Node Type:</label>
            <input type="text" value={node.type} disabled className="read-only" />
          </div>
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter node name"
            />
          </div>
          
          {/* Type-specific configuration fields */}
          {node.type === 'start' && (
            <div className="form-group">
              <label>Initial Data:</label>
              <textarea
                value={nodeConfig.initialData || ''}
                onChange={(e) => setNodeConfig({...nodeConfig, initialData: e.target.value})}
                placeholder="JSON data to start with"
                rows={5}
              />
            </div>
          )}
          
          {node.type === 'condition' && (
            <div className="form-group">
              <label>Condition Expression:</label>
              <textarea
                value={nodeConfig.expression || ''}
                onChange={(e) => setNodeConfig({...nodeConfig, expression: e.target.value})}
                placeholder="e.g., data.temperature > 30"
                rows={3}
              />
            </div>
          )}
          
          {node.type === 'action' && (
            <>
              <div className="form-group">
                <label>Action Type:</label>
                <select 
                  value={nodeConfig.actionType || 'transform'} 
                  onChange={(e) => setNodeConfig({...nodeConfig, actionType: e.target.value})}
                >
                  <option value="transform">Transform</option>
                  <option value="request">API Request</option>
                  <option value="notify">Notification</option>
                </select>
              </div>
              <div className="form-group">
                <label>Action Config:</label>
                <textarea
                  value={nodeConfig.actionConfig || ''}
                  onChange={(e) => setNodeConfig({...nodeConfig, actionConfig: e.target.value})}
                  placeholder="Configuration for this action"
                  rows={5}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} className="primary-button">Save</button>
        </div>
      </div>
    </div>
  );
};

export default NodeConfig; 