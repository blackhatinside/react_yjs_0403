const http = require('http');
const WebSocket = require('ws');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { Awareness } = require('y-protocols/awareness');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const doc = new Y.Doc();
const awareness = new Awareness(doc);

wss.on('connection', (ws) => {
  setupWSConnection(ws, doc, { awareness });

});

server.listen(1234, () => {
  console.log('Server is listening on port 1234');
});