import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

const App = () => {
  const [ruleChain, setRuleChain] = useState(null);
  const [clientInfo, setClientInfo] = useState({ count: 0, clientIDs: [] });

  const docRef = useRef(null);
  const wsProviderRef = useRef(null);
  const indexeddbProviderRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);
  const metadataRef = useRef(null);

  useEffect(() => {
    // Initialize Yjs document and providers
    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider('ws://localhost:1234', 'rule-engine-room', doc);
    const indexeddbProvider = new IndexeddbPersistence('rule-engine', doc);

    docRef.current = doc;
    wsProviderRef.current = wsProvider;
    indexeddbProviderRef.current = indexeddbProvider;

    // Initialize shared data structures
    nodesRef.current = doc.getMap('nodes');
    edgesRef.current = doc.getMap('edges');
    metadataRef.current = doc.getMap('metadata');

    // Set up awareness for client tracking
    wsProvider.awareness.on('change', () => {
      const states = wsProvider.awareness.getStates();
      setClientInfo({
        count: states.size,
        clientIDs: Array.from(states.keys()).map(id => id.toString())
      });
    });

    // Observe changes to nodes and edges
    nodesRef.current.observe(() => {
      setRuleChain(convertFlowToRuleEngineDSL());
    });

    edgesRef.current.observe(() => {
      setRuleChain(convertFlowToRuleEngineDSL());
    });

    // Wait for IndexedDB to load the document
    indexeddbProvider.on('synced', () => {
      if (nodesRef.current.size === 0) {
        // Initialize with a default node if empty
        addNode({
          id: 'node-1',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { type: 'start', metadata: { name: 'Start Node' } }
        });
      }
    });

    // Cleanup
    return () => {
      wsProvider.destroy();
      indexeddbProvider.destroy();
    };
  }, []);

  // Function to add a node
  const addNode = (node) => {
    const yNode = new Y.Map();
    yNode.set('id', node.id);
    yNode.set('type', node.type);
    yNode.set('position', new Y.Map(Object.entries(node.position)));
    yNode.set('data', new Y.Map(Object.entries(node.data)));
    nodesRef.current.set(node.id, yNode);
  };

  // Function to convert flow to rule engine DSL
  const convertFlowToRuleEngineDSL = () => {
    const ruleNodes = [];
    const connections = [];

    nodesRef.current.forEach((yNode) => {
      const node = {
        id: yNode.get('id'),
        type: yNode.get('type'),
        position: Object.fromEntries(yNode.get('position')),
        data: Object.fromEntries(yNode.get('data'))
      };
      ruleNodes.push(node);
    });

    edgesRef.current.forEach((yEdge) => {
      const edge = {
        id: yEdge.get('id'),
        source: yEdge.get('source'),
        target: yEdge.get('target')
      };
      connections.push(edge);
    });

    return {
      RuleChain: {
        ID: metadataRef.current.get('id') || 'default',
        Name: 'Converted Rule Chain',
        Root: true,
        TenantID: metadataRef.current.get('tenantId') || '',
        AdditionalInfo: {
          description: 'Converted from collaborative graph'
        }
      },
      Metadata: {
        FirstNodeIndex: 0,
        Nodes: ruleNodes,
        Connections: connections
      }
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Collaborative Rule Engine</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>Rule Chain</h2>
        <pre style={{
          backgroundColor: '#f5f5f5',
          padding: '15px',
          borderRadius: '4px',
          minHeight: '100px'
        }}>
          {JSON.stringify(ruleChain, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Add Node</h2>
        <button
          onClick={() => addNode({
            id: `node-${nodesRef.current.size + 1}`,
            type: 'default',
            position: { x: 100, y: 100 },
            data: { type: 'default', metadata: { name: `Node ${nodesRef.current.size + 1}` } }
          })}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Add Node
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Connected Clients</h3>
        <p>Total: {clientInfo.count}</p>
        <p>Client IDs: {clientInfo.clientIDs.join(', ')}</p>
      </div>
    </div>
  );
};

export default App;