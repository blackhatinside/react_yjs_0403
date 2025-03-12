import React, { 
  useEffect, 
  useCallback, 
  useState, 
  useRef 
} from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge as rfAddEdge,
  Panel,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  nodesMap, 
  edgesMap, 
  getNodes, 
  getEdges, 
  wsProvider, 
  undoManager, 
  getCurrentRoom, 
  getUsers, 
  switchRoom,
  performUndo,
  performRedo
} from '../yjsSetup';
import { 
  addNode, 
  removeNode, 
  addEdge, 
  removeEdge, 
  updateMetadata, 
  convertToRuleEngineDSL, 
  detectCycle,
  updateNodePosition,
  updateNodeMetadata,
  updateEdgeData,
  importFromJSON
} from '../collabOperations';

import NodeConfig from './NodeConfig';
import EdgeConfig from './EdgeConfig';
import { StartNode, ConditionNode, ActionNode, ConditionalNode, ResponseNode } from './CustomNodes';

// Define custom node types
const nodeTypes = {
  start: StartNode,
  condition: ConditionNode,
  action: ActionNode,
  default: StartNode, // Fallback
  'conditional-node': ConditionalNode,
  'response-node': ResponseNode,
};

// Define edge options with labels instead of colors
const defaultEdgeOptions = {
  style: { stroke: '#555' },
  labelStyle: { fill: '#000', fontWeight: 'bold' },
  labelBgStyle: { fill: 'white', fillOpacity: 0.7 },
  labelBgPadding: [2, 4],
  labelShowBg: true
};

const FlowDiagram = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isValidDiagram, setIsValidDiagram] = useState(true);
  const [ruleChainData, setRuleChainData] = useState(null);
  
  // State for node and edge configuration modals
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  
  // React Flow reference
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();

  const fileInputRef = useRef(null);

  // Inside FlowDiagram component, add state for users and room
  const [users, setUsers] = useState([]);
  const [roomName, setRoomName] = useState(getCurrentRoom());
  const [newRoomName, setNewRoomName] = useState('');
  const [showRoomDialog, setShowRoomDialog] = useState(false);

  // Add these state variables to track undo/redo ability
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialize ReactFlow with Yjs data
  useEffect(() => {
    const forceUpdate = () => {
      setNodes(getNodes());
      setEdges(getEdges());
    };

    // Force initial update
    forceUpdate();

    // Add a periodic sync check
    const syncInterval = setInterval(() => {
      if (wsProvider.shouldConnect) {
        forceUpdate();
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, []);

  // Update rule chain data whenever nodes or edges change
  useEffect(() => {
    try {
      const data = convertToRuleEngineDSL();
      setRuleChainData(data);
    } catch (error) {
      console.error('Error converting to rule engine DSL:', error);
    }
  }, [nodes, edges]);

  // Handle node deletion
  const onNodesDelete = useCallback((nodesToDelete) => {
    try {
      nodesToDelete.forEach(node => {
        removeNode(node.id);
      });
    } catch (error) {
      console.error('Error in onNodesDelete:', error);
    }
  }, []);

  // Handle edge deletion
  const onEdgesDelete = useCallback((edgesToDelete) => {
    try {
      edgesToDelete.forEach(edge => {
        removeEdge(edge.id);
      });
    } catch (error) {
      console.error('Error in onEdgesDelete:', error);
    }
  }, []);

  // Handle edge creation
  const onConnect = useCallback((params) => {
    try {
      const edgeId = `edge-${Date.now()}`;
      const newEdge = {
        id: edgeId,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        data: { operator: 'AND' },
        label: 'AND', // Add label instead of className
        labelStyle: defaultEdgeOptions.labelStyle,
        labelBgStyle: defaultEdgeOptions.labelBgStyle,
        labelBgPadding: defaultEdgeOptions.labelBgPadding,
        labelShowBg: defaultEdgeOptions.labelShowBg
      };
      
      addEdge(newEdge);
    } catch (error) {
      console.error('Error in onConnect:', error);
    }
  }, []);

  // Add a new node
  const onAddNode = (type) => {
    try {
      const nodeId = `node-${Date.now()}`;
      const position = {
        x: Math.random() * 400,
        y: Math.random() * 400
      };
      
      const newNode = {
        id: nodeId,
        type: type || 'default',
        position: position,
        data: {
          type: type || 'default',
          metadata: {
            name: `New ${type || 'Default'} Node`
          }
        }
      };
      
      addNode(newNode);
    } catch (error) {
      console.error(`Error adding ${type} node:`, error);
    }
  };

  // Handle node position update on drag end
  const onNodeDragStop = useCallback((event, node) => {
    try {
      // Update the position in Yjs
      updateNodePosition(node.id, node.position);
    } catch (error) {
      console.error('Error updating node position:', error);
    }
  }, []);

  // Handle node double-click to open configuration
  const onNodeDoubleClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle edge double-click to open configuration
  const onEdgeDoubleClick = useCallback((event, edge) => {
    setSelectedEdge(edge);
  }, []);

  // Save node configuration
  const onSaveNodeConfig = useCallback((nodeId, metadata) => {
    try {
      updateNodeMetadata(nodeId, metadata);
    } catch (error) {
      console.error('Error saving node configuration:', error);
    }
  }, []);

  // Save edge configuration
  const onSaveEdgeConfig = useCallback((edgeId, data) => {
    try {
      updateEdgeData(edgeId, data);
    } catch (error) {
      console.error('Error saving edge configuration:', error);
    }
  }, []);

  // Export diagram to DSL
  const onExportDiagram = () => {
    try {
      if (!isValidDiagram) {
        alert('Cannot export diagram with cycles!');
        return;
      }
      
      const dslData = convertToRuleEngineDSL();
      console.log('Rule Engine DSL:', dslData);
      // Here you could send this to your server or download it
      const dataStr = JSON.stringify(dslData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rule-chain.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting diagram:', error);
    }
  };

  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          const success = importFromJSON(jsonData);
          if (success) {
            console.log('Diagram imported successfully');
          } else {
            console.error('Failed to import diagram');
          }
        } catch (error) {
          console.error('Error parsing JSON file:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current.click();
  };

  // Add keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          undoManager.redo();
        } else {
          undoManager.undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        undoManager.redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Add awareness update handling for users
  useEffect(() => {
    const updateUsers = () => {
      setUsers(getUsers());
      setRoomName(getCurrentRoom());
    };

    // Initial update
    updateUsers();

    // Listen for awareness changes
    wsProvider.awareness.on('update', updateUsers);

    return () => {
      wsProvider.awareness.off('update', updateUsers);
    };
  }, []);

  // Add room switching function
  const handleRoomSwitch = () => {
    if (newRoomName.trim()) {
      switchRoom(newRoomName.trim());
      setNewRoomName('');
      setShowRoomDialog(false);
    }
  };

  // Add this useEffect to update the undo/redo state
  useEffect(() => {
    const updateUndoRedoState = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };
    
    // Update initially and after any undoable change
    updateUndoRedoState();
    undoManager.on('stack-item-added', updateUndoRedoState);
    undoManager.on('stack-item-popped', updateUndoRedoState);
    
    return () => {
      undoManager.off('stack-item-added', updateUndoRedoState);
      undoManager.off('stack-item-popped', updateUndoRedoState);
    };
  }, []);

  // Ensure room name state is updated when it changes
  useEffect(() => {
    setRoomName(getCurrentRoom());
    
    // Update when room changes
    const handleRoomChange = () => {
      setRoomName(getCurrentRoom());
    };
    
    // Add listener for room changes
    window.addEventListener('room-changed', handleRoomChange);
    
    return () => {
      window.removeEventListener('room-changed', handleRoomChange);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '80vh' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgeUpdate={(oldEdge, newConnection) => {
          try {
            // Remove old edge
            removeEdge(oldEdge.id);
            
            // Create new edge with same ID but updated endpoints
            const updatedEdge = {
              ...oldEdge,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle,
              targetHandle: newConnection.targetHandle
            };
            
            addEdge(updatedEdge);
          } catch (error) {
            console.error('Error updating edge:', error);
          }
        }}
        edgeUpdaterRadius={20} // Radius for edge endpoint modification
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
        
        <Panel position="top-right">
          <div className="flow-controls">
            {/* <button onClick={() => onAddNode('start')}>Add Start Node</button> */}
            <button onClick={() => onAddNode('condition')}>Add Condition</button>
            <button onClick={() => onAddNode('action')}>Add Response</button>
            <button onClick={onExportDiagram} disabled={!isValidDiagram}>
              Export Diagram
            </button>
            <button onClick={openFileDialog}>Import Diagram</button>
            <button 
              onClick={performUndo} 
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button 
              onClick={performRedo} 
              disabled={!canRedo}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              Redo
            </button>
            <span className="users-info">
              {users.length > 1 
                ? `${users.length - 1} other ${users.length - 1 === 1 ? 'user' : 'users'} online` 
                : "No other users online"}
            </span>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleImportFile}
            />
            {!isValidDiagram && (
              <div className="error-message">
                Cycle detected in diagram! Please remove the cycle before exporting.
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
      
      {/* Node Configuration Modal */}
      {selectedNode && (
        <NodeConfig 
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={onSaveNodeConfig}
        />
      )}
      
      {/* Edge Configuration Modal */}
      {selectedEdge && (
        <EdgeConfig 
          edge={selectedEdge}
          onClose={() => setSelectedEdge(null)}
          onSave={onSaveEdgeConfig}
        />
      )}
      
      {ruleChainData && (
        <div className="rule-chain-preview">
          <h3>Rule Chain Preview</h3>
          <pre>{JSON.stringify(ruleChainData, null, 2)}</pre>
        </div>
      )}
      
      {showRoomDialog && (
        <div className="room-dialog-overlay">
          <div className="room-dialog">
            <h3>Switch Room</h3>
            <p>Current room: {roomName}</p>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter new room name"
            />
            <div className="room-dialog-buttons">
              <button onClick={handleRoomSwitch}>Join Room</button>
              <button onClick={() => setShowRoomDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="app-header">
        <div className="app-title">
          Collaborative Rule Engine Designer - Room: {roomName}
        </div>
        <div className="user-info">
          <UserAwarenessDropdown users={users} />
          <button onClick={() => setShowRoomDialog(true)} className="room-switch-btn">
            Switch Room
          </button>
        </div>
      </div>
    </div>
  );
};

const UserAwarenessDropdown = ({ users }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="user-awareness-dropdown">
      <div 
        className="dropdown-trigger"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {users.length > 1 
          ? `${users.length - 1} other ${users.length - 1 === 1 ? 'user' : 'users'} online` 
          : "No other users online"}
        {isOpen && users.length > 1 && (
          <div className="dropdown-content">
            <ul>
              {users.filter(user => user.clientId !== wsProvider.awareness.clientID).map(user => (
                <li key={user.clientId} style={{ color: user.color }}>
                  {user.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowDiagram; 