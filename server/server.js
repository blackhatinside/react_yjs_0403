const WebSocket = require('ws');
const http = require('http');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const map = require('lib0/map');

const CALLBACK_DEBOUNCE_WAIT = 2000;
const CALLBACK_DEBOUNCE_MAXWAIT = 10000;

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2;
const wsReadyStateClosed = 3;

// Map from room name to set of connected clients
const rooms = new Map();

// Map from client connection to room
const conns = new Map();

// Map from room name to Y.Doc instance
const docs = new Map();

// Map from room name to awareness instance
const roomAwareness = new Map();

const messageSync = 0;
const messageAwareness = 1;

const getYDoc = (roomName, gc = true) => {
  let doc = docs.get(roomName);
  if (!doc) {
    doc = new Y.Doc({ gc });
    docs.set(roomName, doc);
    
    // Create awareness for this doc
    const awareness = new awarenessProtocol.Awareness(doc);
    roomAwareness.set(roomName, awareness);
    
    // Clean up awareness states when clients disconnect
    awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = [...added, ...updated, ...removed];
      const room = rooms.get(roomName);
      if (room) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
        );
        const buf = encoding.toUint8Array(encoder);
        room.forEach(client => {
          if (client.readyState === wsReadyStateOpen) {
            client.send(buf);
          }
        });
      }
    });
  }
  return doc;
};

const getAwareness = (roomName) => {
  return roomAwareness.get(roomName);
};

const messageListener = (conn, message) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        const syncMessageType = decoding.readVarUint(decoder);
        
        switch (syncMessageType) {
          case syncProtocol.messageYjsSyncStep1:
            const roomName = conns.get(conn);
            if (roomName) {
              const doc = getYDoc(roomName);
              syncProtocol.readSyncStep1(decoder, encoder, doc);
            }
            break;
          case syncProtocol.messageYjsSyncStep2:
          case syncProtocol.messageYjsUpdate:
            const roomName2 = conns.get(conn);
            if (roomName2) {
              const doc = getYDoc(roomName2);
              const update = decoding.readVarUint8Array(decoder);
              Y.applyUpdate(doc, update);
              
              // Broadcast the update to all clients except the sender
              const room = rooms.get(roomName2);
              if (room) {
                room.forEach(client => {
                  if (client !== conn && client.readyState === wsReadyStateOpen) {
                    client.send(message);
                  }
                });
              }
            }
            break;
          default:
            console.error('Unknown sync message type:', syncMessageType);
        }
        
        if (encoding.length(encoder) > 1) {
          conn.send(encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness:
        const roomName = conns.get(conn);
        if (roomName) {
          const awareness = getAwareness(roomName);
          if (awareness) {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(awareness, update, conn);
          }
        }
        break;
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
};

const setupWSConnection = (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default-room';
  
  // Add client to room
  let room = rooms.get(roomName);
  if (!room) {
    room = new Set();
    rooms.set(roomName, room);
  }
  room.add(conn);
  
  // Map connection to room name
  conns.set(conn, roomName);
  
  // Setup message handler
  conn.on('message', message => messageListener(conn, message));
  
  // Handle connection close
  conn.on('close', () => {
    const roomName = conns.get(conn);
    if (roomName) {
      const room = rooms.get(roomName);
      if (room) {
        room.delete(conn);
        if (room.size === 0) {
          rooms.delete(roomName);
        }
      }
      
      // Clean up awareness state for disconnected client
      const awareness = getAwareness(roomName);
      if (awareness) {
        // Use the client's id to remove its awareness state
        awarenessProtocol.removeAwarenessStates(
          awareness,
          [conn.clientID],
          'connection closed'
        );
      }
      
      conns.delete(conn);
    }
  });
  
  // Send initial state to client
  const doc = getYDoc(roomName);
  const awareness = getAwareness(roomName);
  
  // Assign a client ID to the connection for awareness tracking
  conn.clientID = doc.clientID;
  
  // Send document sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  conn.send(encoding.toUint8Array(encoder));
  
  // Send document update (sync step 2)
  const encoder2 = encoding.createEncoder();
  encoding.writeVarUint(encoder2, messageSync);
  syncProtocol.writeSyncStep2(encoder2, doc);
  conn.send(encoding.toUint8Array(encoder2));
  
  // Send awareness update if there are any states
  if (awareness && awareness.getStates().size > 0) {
    const awarenessStates = Array.from(awareness.getStates().keys());
    const encoder3 = encoding.createEncoder();
    encoding.writeVarUint(encoder3, messageAwareness);
    encoding.writeVarUint8Array(
      encoder3,
      awarenessProtocol.encodeAwarenessUpdate(awareness, awarenessStates)
    );
    conn.send(encoding.toUint8Array(encoder3));
  }
};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server for Y.js is running');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (conn, req) => setupWSConnection(conn, req));

const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
  console.log(`Collaboration server ready at ws://localhost:${PORT}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.clients.forEach(client => {
    client.close();
  });
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});

// Optional: Persistent storage if needed
// const LeveldbPersistence = require('y-leveldb').LeveldbPersistence;
// const ldb = new LeveldbPersistence('./storage-location');
// ldb.bindState('my-document-name', getYDoc('my-room'));
