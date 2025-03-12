import * as Y from 'yjs';
import { 
  WebsocketProvider 
} from 'y-websocket';
import { 
  IndexeddbPersistence 
} from 'y-indexeddb';
import * as awarenessProtocol from 'y-protocols/awareness';

// Create a Yjs document
export const ydoc = new Y.Doc();

// Get the initial room from URL params or use 'default' room
const urlParams = new URLSearchParams(window.location.search);
const initialRoom = urlParams.get('room') || 'default';

// Create shared data structures
export const nodesMap = ydoc.getMap('nodes');
export const edgesMap = ydoc.getMap('edges');
export const metadataMap = ydoc.getMap('metadata');

// Setup WebSocket provider with awareness
export const wsProvider = new WebsocketProvider(
  'ws://10.60.1.38:1234', 
  initialRoom,
  ydoc,
  { connect: true }
);

// Initialize awareness
export const awareness = wsProvider.awareness;

// Local persistence to survive page reloads
export const indexeddbProvider = new IndexeddbPersistence('rule-engine-room', ydoc);

// Export awarenessProtocol for use in other files
export { awarenessProtocol };

// Initialize metadata with default values if it doesn't exist yet
if (metadataMap.size === 0) {
  metadataMap.set('id', 'default-rule-chain');
  metadataMap.set('name', 'New Rule Chain');
  metadataMap.set('tenantId', 'demo');
}

// Update the UndoManager implementation
export const undoManager = new Y.UndoManager([nodesMap, edgesMap], {
  // Track changes from all sources, not just the current client
  trackedOrigins: new Set([null])
});

// Export helpers for undo/redo
export const performUndo = () => {
  if (undoManager.canUndo()) {
    undoManager.undo();
    return true;
  }
  return false;
};

export const performRedo = () => {
  if (undoManager.canRedo()) {
    undoManager.redo();
    return true;
  }
  return false;
};

// Add keyboard event listener to document when this module loads
document.addEventListener('keydown', (event) => {
  // Handle Ctrl+Z or Cmd+Z for undo
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    performUndo();
  }
  // Handle Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
  else if (
    ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
    ((event.ctrlKey || event.metaKey) && event.key === 'y')
  ) {
    event.preventDefault();
    performRedo();
  }
});

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

// Helper function to get nodes and edges
export const getNodes = () => {
  const nodes = [];
  nodesMap.forEach((value, key) => {
    const node = {
      id: value.get('id'),
      type: value.get('type'),
      position: {
        x: value.get('position').get('x'),
        y: value.get('position').get('y')
      },
      data: {
        type: value.get('data').get('type'),
        isNot: value.get('data').has('isNot') ? value.get('data').get('isNot') : false
      }
    };
    
    if (value.get('data').has('metadata')) {
      node.data.metadata = {};
      const metadata = value.get('data').get('metadata');
      metadata.forEach((value, key) => {
        node.data.metadata[key] = value;
      });
    }
    
    nodes.push(node);
  });
  return nodes;
};

export const getEdges = () => {
  const edges = [];
  edgesMap.forEach((value, key) => {
    const edge = {
      id: value.get('id'),
      source: value.get('source'),
      target: value.get('target'),
    };
    
    if (value.has('sourceHandle')) {
      edge.sourceHandle = value.get('sourceHandle');
    }
    
    if (value.has('targetHandle')) {
      edge.targetHandle = value.get('targetHandle');
    }
    
    if (value.has('data')) {
      edge.data = {};
      const data = value.get('data');
      data.forEach((value, key) => {
        edge.data[key] = value;
      });
    }
    
    if (value.has('className')) {
      edge.className = value.get('className');
    }
    
    edge.label = edge.data?.operator || 'AND';
    
    edges.push(edge);
  });
  return edges;
};

// Track current room name
export const getCurrentRoom = () => wsProvider.roomname;

// Handle room switching
export const switchRoom = (newRoom) => {
  // Disconnect current provider
  wsProvider.disconnect();
  
  // Update URL
  const url = new URL(window.location);
  url.searchParams.set('room', newRoom);
  window.history.pushState({}, '', url);
  
  // Connect to new room
  wsProvider.roomname = newRoom;
  wsProvider.connect();
  
  // Dispatch custom event trigger
  window.dispatchEvent(new CustomEvent('room-changed'));
};

// Get current user count
export const getUserCount = () => {
  let count = 0;
  wsProvider.awareness.getStates().forEach(() => count++);
  return count;
};

// Generate a random color for the user
const getRandomColor = () => {
  const colors = [
    '#ecd444', '#ee6352', '#6eeb83', '#5ac4f8', '#e36bae',
    '#b252ea', '#f19d38', '#4affda', '#c6b8d6', '#36cacc'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Set user information with a random color and name
export const setUserInfo = (name = `User ${Math.floor(Math.random() * 1000)}`) => {
  const clientId = awareness.clientID;
  
  awareness.setLocalStateField('user', {
    name,
    color: getRandomColor(),
    clientId: awareness.clientID
  });
  
  console.log(`Set user info for client ${clientId}: ${name}`);
};

// Initialize user if not already set
if (!awareness.getLocalState()?.user) {
  setUserInfo();
}

// Get all users from awareness
export const getUsers = () => {
  const users = [];
  awareness.getStates().forEach((state, clientId) => {
    if (state.user) {
      users.push({
        clientId,
        name: state.user.name,
        color: state.user.color
      });
    }
  });
  
  console.log(`Current users: ${users.length}`, users);
  return users;
};

// Add better error handling
wsProvider.on('status', event => {
  const statusMap = {
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected'
  };
  console.log('Connection status:', statusMap[event.status] || 'Unknown');
});

wsProvider.on('sync', (isSynced) => {
  if (isSynced) {
    console.log('Fully synced with server');
  }
});
