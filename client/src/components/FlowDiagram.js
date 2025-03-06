import React, { useEffect, useCallback, useState, useRef } from 'react';
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

import { nodesMap, edgesMap, getNodes, getEdges, wsProvider } from '../yjsSetup';
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
  updateEdgeData
} from '../collabOperations';

import NodeConfig from './NodeConfig';
import EdgeConfig from './EdgeConfig';
import { StartNode, ConditionNode, ActionNode } from './CustomNodes';

// Define custom node types
const nodeTypes = {
  start: StartNode,
  condition: ConditionNode,
  action: ActionNode,
  default: StartNode // Fallback
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
        className: 'AND' // Add className for styling
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
            <button onClick={() => onAddNode('start')}>Add Start Node</button>
            <button onClick={() => onAddNode('condition')}>Add Condition</button>
            <button onClick={() => onAddNode('action')}>Add Action</button>
            <button onClick={onExportDiagram} disabled={!isValidDiagram}>
              Export Diagram
            </button>
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
    </div>
  );
};

export default FlowDiagram; 