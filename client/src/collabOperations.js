import * as Y from 'yjs';
import { nodesMap, edgesMap, metadataMap } from './yjsSetup';
import { mapToArray } from './yjsSetup';

// Add/Update node
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
    
    // Add to nodes map
    nodesMap.set(node.id, nodeData);
    
    return node.id;
  } catch (error) {
    console.error('Error adding node:', error);
    return null;
  }
};

// Remove node
export const removeNode = (nodeId) => {
  try {
    // First, remove any edges connected to this node
    const edgesToRemove = [];
    
    edgesMap.forEach((edge, edgeId) => {
      if (edge.get('source') === nodeId || edge.get('target') === nodeId) {
        edgesToRemove.push(edgeId);
      }
    });
    
    // Delete the connected edges
    edgesToRemove.forEach(edgeId => {
      edgesMap.delete(edgeId);
    });
    
    // Delete the node
    nodesMap.delete(nodeId);
    
    return true;
  } catch (error) {
    console.error('Error removing node:', error);
    return false;
  }
};

// Add/Update edge
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
    
    if (edge.data) {
      const data = new Y.Map();
      if (edge.data.operator) {
        data.set('operator', edge.data.operator);
      }
      edgeData.set('data', data);
    }
    
    // Add to edges map
    edgesMap.set(edge.id, edgeData);
    
    return edge.id;
  } catch (error) {
    console.error('Error adding edge:', error);
    return null;
  }
};

// Remove edge
export const removeEdge = (edgeId) => {
  try {
    edgesMap.delete(edgeId);
    return true;
  } catch (error) {
    console.error('Error removing edge:', error);
    return false;
  }
};

// Update metadata
export const updateMetadata = (key, value) => {
  try {
    metadataMap.set(key, value);
    return true;
  } catch (error) {
    console.error('Error updating metadata:', error);
    return false;
  }
};

// Convert Yjs data to rule engine DSL
export const convertToRuleEngineDSL = () => {
  const nodes = [];
  const connections = [];
  
  // Convert nodes
  nodesMap.forEach((yNode, key) => {
    if (!yNode) return;
    
    try {
      const position = yNode.get('position');
      const data = yNode.get('data');
      
      const node = {
        id: yNode.get('id'),
        type: yNode.get('type'),
        position: {
          x: position.get('x'),
          y: position.get('y')
        },
        data: {
          type: data.get('type')
        }
      };
      
      // Add isNot if it exists
      if (data.has('isNot')) {
        node.data.isNot = data.get('isNot');
      }
      
      // Add metadata if it exists
      if (data.has('metadata')) {
        node.data.metadata = {};
        const meta = data.get('metadata');
        
        // Check if meta is a Y.Map before using forEach
        if (meta && typeof meta.forEach === 'function') {
          meta.forEach((value, key) => {
            node.data.metadata[key] = value;
          });
        } else if (typeof meta === 'object') {
          // Handle plain objects
          Object.entries(meta).forEach(([key, value]) => {
            node.data.metadata[key] = value;
          });
        }
      }
      
      nodes.push(node);
    } catch (error) {
      console.error(`Error converting node ${key} to DSL:`, error);
    }
  });
  
  // Convert edges
  edgesMap.forEach((yEdge, key) => {
    if (!yEdge) return;
    
    try {
      const edge = {
        id: yEdge.get('id'),
        source: yEdge.get('source'),
        target: yEdge.get('target')
      };
      
      if (yEdge.has('sourceHandle')) {
        edge.sourceHandle = yEdge.get('sourceHandle');
      }
      
      if (yEdge.has('targetHandle')) {
        edge.targetHandle = yEdge.get('targetHandle');
      }
      
      if (yEdge.has('data')) {
        const data = yEdge.get('data');
        if (data) {
          edge.data = {};
          if (data.has('operator')) {
            edge.data.operator = data.get('operator');
          }
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
};

// Helper to detect cycles in the graph
export const detectCycle = (edges) => {
  const graph = {};
  
  // Build adjacency list
  edges.forEach(edge => {
    if (!graph[edge.source]) {
      graph[edge.source] = [];
    }
    graph[edge.source].push(edge.target);
  });
  
  const visited = {};
  const recursionStack = {};
  
  const isCyclicUtil = (nodeId) => {
    if (!visited[nodeId]) {
      visited[nodeId] = true;
      recursionStack[nodeId] = true;
      
      const neighbors = graph[nodeId] || [];
      for (const neighbor of neighbors) {
        if (!visited[neighbor] && isCyclicUtil(neighbor)) {
          return true;
        } else if (recursionStack[neighbor]) {
          return true;
        }
      }
    }
    
    recursionStack[nodeId] = false;
    return false;
  };
  
  for (const nodeId in graph) {
    if (isCyclicUtil(nodeId)) {
      return true;
    }
  }
  
  return false;
};
