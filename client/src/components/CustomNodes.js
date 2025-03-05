import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import '../node-styles.css';

// Common base component for all node types
const BaseNode = ({ id, data, type, selected }) => {
  return (
    <div className={`custom-node ${type}-node ${selected ? 'selected' : ''}`}>
      <div className="node-id">{id}</div>
      <div className="node-title">
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
      <div className="node-name">
        {data.metadata?.name || `Unnamed ${type}`}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export const StartNode = memo((props) => <BaseNode {...props} />);
export const ConditionNode = memo((props) => <BaseNode {...props} />);
export const ActionNode = memo((props) => <BaseNode {...props} />); 