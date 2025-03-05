import * as Y from 'yjs';
import { nodesMap, edgesMap, metadataMap } from './yjsSetup';

// Add a node to the Yjs document
export const addNode = (node) => {
  try {
    const nodeData = new Y.Map();
    
    // Set basic node properties
    nodeData.set('id', node.id);
    nodeData.set('type', node.type);
    
    // Create and set position
    const position = new Y.Map();
    position.set('x', node.position.x);
    position.set('y', node.position.y);
    nodeData.set('position', position);
    
    // Create and set data
    const data = new Y.Map();
    data.set('type', node.data.type);
    
    if (node.data.isNot !== undefined) {
      data.set('isNot', node.data.isNot);
    }
    
    if (node.data.metadata) {
      const metadata = new Y.Map();
      Object.entries(node.data.metadata).forEach(([key, value]) => {
        metadata.set(key, value);
      });
      data.set('metadata', metadata);
    }
    
    nodeData.set('data', data);
    
    // Add to the Yjs map
    nodesMap.set(node.id, nodeData);
  } catch (error) {
    console.error('Error adding node:', error);
  }
};

// Remove a node from the Yjs document
export const removeNode = (nodeId) => {
  try {
    nodesMap.delete(nodeId);
    
    // Also remove any connected edges
    edgesMap.forEach((edge, edgeId) => {
      if (edge.get('source') === nodeId || edge.get('target') === nodeId) {
        edgesMap.delete(edgeId);
      }
    });
  } catch (error) {
    console.error(`Error removing node ${nodeId}:`, error);
  }
};

// Add an edge to the Yjs document
export const addEdge = (edge) => {
  try {
    const edgeData = new Y.Map();
    
    // Set basic edge properties
    edgeData.set('id', edge.id);
    edgeData.set('source', edge.source);
    edgeData.set('target', edge.target);
    
    if (edge.sourceHandle) {
      edgeData.set('sourceHandle', edge.sourceHandle);
    }
    
    if (edge.targetHandle) {
      edgeData.set('targetHandle', edge.targetHandle);
    }
    
    // Set data if available
    if (edge.data) {
      const data = new Y.Map();
      if (edge.data.operator) {
        data.set('operator', edge.data.operator);
      }
      edgeData.set('data', data);
    } else {
      // Default data with AND operator
      const data = new Y.Map();
      data.set('operator', 'AND');
      edgeData.set('data', data);
    }
    
    // Add to the Yjs map
    edgesMap.set(edge.id, edgeData);
  } catch (error) {
    console.error('Error adding edge:', error);
  }
};

// Remove an edge from the Yjs document
export const removeEdge = (edgeId) => {
  try {
    edgesMap.delete(edgeId);
  } catch (error) {
    console.error(`Error removing edge ${edgeId}:`, error);
  }
};

// Update node metadata
export const updateNodeMetadata = (nodeId, metadata) => {
  try {
    const nodeData = nodesMap.get(nodeId);
    if (nodeData) {
      const data = nodeData.get('data');
      if (data) {
        // Create a new Y.Map for metadata if it doesn't exist
        if (!data.has('metadata')) {
          const metadataMap = new Y.Map();
          data.set('metadata', metadataMap);
        }
        
        const metadataYMap = data.get('metadata');
        
        // Update all metadata properties
        data.doc.transact(() => {
          Object.entries(metadata).forEach(([key, value]) => {
            metadataYMap.set(key, value);
          });
        });
      }
    }
  } catch (error) {
    console.error(`Error updating metadata for node ${nodeId}:`, error);
  }
};

// Update node position
export const updateNodePosition = (nodeId, newPosition) => {
  try {
    const nodeData = nodesMap.get(nodeId);
    if (nodeData) {
      const position = nodeData.get('position');
      if (position) {
        // Update position with transaction to ensure atomic update
        position.doc.transact(() => {
          position.set('x', newPosition.x);
          position.set('y', newPosition.y);
        });
      }
    }
  } catch (error) {
    console.error(`Error updating position for node ${nodeId}:`, error);
  }
};

// Update edge data including operator
export const updateEdgeData = (edgeId, edgeData) => {
  try {
    const edgeYMap = edgesMap.get(edgeId);
    if (edgeYMap) {
      // Create a new Y.Map for data if it doesn't exist
      if (!edgeYMap.has('data')) {
        const dataMap = new Y.Map();
        edgeYMap.set('data', dataMap);
      }
      
      const dataYMap = edgeYMap.get('data');
      
      // Update all edge data properties
      edgeYMap.doc.transact(() => {
        Object.entries(edgeData).forEach(([key, value]) => {
          dataYMap.set(key, value);
        });
      });
    }
  } catch (error) {
    console.error(`Error updating data for edge ${edgeId}:`, error);
  }
};

// Update edge endpoints
export const updateEdgeEndpoints = (edgeId, { source, target, sourceHandle, targetHandle }) => {
  try {
    const edge = edgesMap.get(edgeId);
    if (edge) {
      if (source) edge.set('source', source);
      if (target) edge.set('target', target);
      if (sourceHandle) edge.set('sourceHandle', sourceHandle);
      if (targetHandle) edge.set('targetHandle', targetHandle);
    }
  } catch (error) {
    console.error(`Error updating edge ${edgeId} endpoints:`, error);
  }
};

// Update rule chain metadata
export const updateMetadata = (metadata) => {
  try {
    Object.entries(metadata).forEach(([key, value]) => {
      metadataMap.set(key, value);
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
  }
};

// Detect cycles in the graph
export const detectCycle = (edges) => {
  try {
    const graph = {};
    
    // Build adjacency list
    edges.forEach(edge => {
      if (!graph[edge.source]) {
        graph[edge.source] = [];
      }
      graph[edge.source].push(edge.target);
    });
    
    // Set of visited nodes for the current traversal
    const visited = new Set();
    // Set of nodes in the current recursion stack
    const recStack = new Set();
    
    // DFS function to detect cycle
    const isCyclicUtil = (nodeId) => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        recStack.add(nodeId);
        
        if (graph[nodeId]) {
          for (const neighbor of graph[nodeId]) {
            if (!visited.has(neighbor) && isCyclicUtil(neighbor)) {
              return true;
            } else if (recStack.has(neighbor)) {
              return true;
            }
          }
        }
      }
      
      recStack.delete(nodeId);
      return false;
    };
    
    // Check all nodes
    for (const nodeId in graph) {
      if (isCyclicUtil(nodeId)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error detecting cycles:', error);
    return false;
  }
};

// Convert to rule engine DSL
export const convertToRuleEngineDSL = () => {
  try {
    const nodes = [];
    const connections = [];
    
    // Convert nodes to DSL format
    nodesMap.forEach((yNode, key) => {
      try {
        const node = {
          id: yNode.get('id'),
          type: yNode.get('data').get('type')
        };
        
        if (yNode.get('data').has('metadata')) {
          const metadata = yNode.get('data').get('metadata');
          node.name = metadata.get('name') || `New ${node.type} Node`;
          
          // Add any other metadata specific to node type
          if (node.type === 'start' && metadata.has('initialData')) {
            node.initialData = metadata.get('initialData');
          } else if (node.type === 'condition') {
            if (metadata.has('expression')) {
              node.expression = metadata.get('expression');
            }
            if (yNode.get('data').has('isNot')) {
              node.isNot = yNode.get('data').get('isNot');
            }
          } else if (node.type === 'action') {
            if (metadata.has('actionType')) {
              node.actionType = metadata.get('actionType');
            }
            if (metadata.has('actionConfig')) {
              node.actionConfig = metadata.get('actionConfig');
            }
          }
        }
        
        nodes.push(node);
      } catch (error) {
        console.error(`Error converting node ${key} to DSL:`, error);
      }
    });
    
    // Convert edges to DSL format
    edgesMap.forEach((yEdge, key) => {
      try {
        const edge = {
          from: yEdge.get('source'),
          to: yEdge.get('target')
        };
        
        if (yEdge.has('data')) {
          const data = yEdge.get('data');
          if (data && data.has('operator')) {
            edge.type = data.get('operator');
          }
        }
        
        connections.push(edge);
      } catch (error) {
        console.error(`Error converting edge ${key} to DSL:`, error);
      }
    });
    
    // Create the final rule engine DSL
    return {
      ruleChain: {
        id: metadataMap.get('id') || 'default-rule-chain',
        name: metadataMap.get('name') || 'New Rule Chain',
        tenantId: metadataMap.get('tenantId') || 'demo',
        nodes: nodes,
        connections: connections
      }
    };
  } catch (error) {
    console.error('Error converting to rule engine DSL:', error);
    return { error: 'Failed to convert to rule engine DSL' };
  }
};
