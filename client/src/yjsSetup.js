import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as awarenessProtocol from 'y-protocols/awareness';

// Create a Yjs document
export const ydoc = new Y.Doc();

// Initialize awareness
export const awareness = new awarenessProtocol.Awareness(ydoc);

// Connect to the websocket provider
export const wsProvider = new WebsocketProvider(
  'ws://10.60.2.92:1234', 
  'rule-engine-room',
  ydoc,
  { 
    connect: true,
    maxBackoffTime: 2000,
    disableBc: true,
    awareness: awareness
  }
);

// Local persistence to survive page reloads
export const indexeddbProvider = new IndexeddbPersistence('rule-engine-room', ydoc);

// Shared data maps
export const nodesMap = ydoc.getMap('nodes');
export const edgesMap = ydoc.getMap('edges');
export const metadataMap = ydoc.getMap('metadata');

// Export awarenessProtocol for use in other files
export { awarenessProtocol };

// Initialize metadata with default values if it doesn't exist yet
if (metadataMap.size === 0) {
  metadataMap.set('id', 'default-rule-chain');
  metadataMap.set('name', 'New Rule Chain');
  metadataMap.set('tenantId', 'demo');
}

// Helper function to convert Y.Map to array
export const mapToArray = (yMap) => {
  const result = [];
  yMap.forEach((value, key) => {
    // Convert Y.Map to plain object
    if (value instanceof Y.Map) {
      const obj = {};
      value.forEach((v, k) => {
        if (v instanceof Y.Map) {
          const nestedObj = {};
          v.forEach((nv, nk) => nestedObj[nk] = nv);
          obj[k] = nestedObj;
        } else {
          obj[k] = v;
        }
      });
      obj.id = key;
      result.push(obj);
    } else {
      result.push({ id: key, ...value });
    }
  });
  return result;
};

// Helper function to get nodes as React Flow nodes
export const getNodes = () => {
  const nodes = [];
  nodesMap.forEach((yNode, id) => {
    if (!yNode) return;
    
    try {
      const position = yNode.get('position');
      const data = yNode.get('data');
      
      const node = {
        id: id,
        type: yNode.get('type'),
        position: {
          x: position.get('x'),
          y: position.get('y')
        },
        data: {
          type: data.get('type')
        }
      };
      
      if (data.has('isNot')) {
        node.data.isNot = data.get('isNot');
      }
      
      if (data.has('metadata')) {
        const metadata = data.get('metadata');
        node.data.metadata = {};
        
        if (metadata instanceof Y.Map) {
          metadata.forEach((value, key) => {
            node.data.metadata[key] = value;
          });
        }
      }
      
      nodes.push(node);
    } catch (error) {
      console.error(`Error processing node ${id}:`, error);
    }
  });
  
  return nodes;
};

// Helper function to get edges as React Flow edges
export const getEdges = () => {
  const edges = [];
  edgesMap.forEach((yEdge, id) => {
    if (!yEdge) return;
    
    try {
      const edge = {
        id: id,
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
      
      edges.push(edge);
    } catch (error) {
      console.error(`Error processing edge ${id}:`, error);
    }
  });
  
  return edges;
};

// Add better error handling
wsProvider.on('status', event => {
  console.log('WebSocket connection status:', event.status);
  if (event.status === 'connected') {
    // Force reconnection if needed
    if (!wsProvider.connected) {
      wsProvider.connect();
    }
  }
});

wsProvider.on('sync', (isSynced) => {
  if (isSynced) {
    console.log('Fully synced with server');
  }
});
