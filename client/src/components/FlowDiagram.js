import React, { useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge as rfAddEdge,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodesMap, edgesMap, getNodes, getEdges } from '../yjsSetup';
import { addNode, removeNode, addEdge, removeEdge, updateMetadata, convertToRuleEngineDSL, detectCycle } from '../collabOperations';

const nodeTypes = {
  // Custom node types could be defined here
};

const FlowDiagram = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isValidDiagram, setIsValidDiagram] = useState(true);
  const [ruleChainData, setRuleChainData] = useState(null);

  // Initialize ReactFlow with Yjs data
  useEffect(() => {
    try {
      // Load initial data
      setNodes(getNodes());
      setEdges(getEdges());

      // Observe changes to the Yjs maps
      const nodesObserver = () => {
        try {
          const flowNodes = getNodes();
          setNodes(flowNodes);
        } catch (error) {
          console.error('Error in nodesObserver:', error);
        }
      };
      
      const edgesObserver = () => {
        try {
          const flowEdges = getEdges();
          setEdges(flowEdges);
          
          // Check for cycles whenever edges change
          const hasCycle = detectCycle(flowEdges);
          setIsValidDiagram(!hasCycle);
        } catch (error) {
          console.error('Error in edgesObserver:', error);
        }
      };

      // Register observers
      nodesMap.observe(nodesObserver);
      edgesMap.observe(edgesObserver);

      // Clean up observers on component unmount
      return () => {
        nodesMap.unobserve(nodesObserver);
        edgesMap.unobserve(edgesObserver);
      };
    } catch (error) {
      console.error('Error in FlowDiagram useEffect:', error);
    }
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
        targetHandle: params.targetHandle
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
    <div style={{ width: '100%', height: '80vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
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