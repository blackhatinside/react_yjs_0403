import React, { useEffect, useState } from 'react';
import { ydoc, awareness, wsProvider, awarenessProtocol } from './yjsSetup';
import { ReactFlowProvider } from 'reactflow';
import FlowDiagram from './components/FlowDiagram';
import './App.css';

const App = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    const handleStatus = (event) => {
      console.log('Connection status:', event.status);
      
      // Map the raw status to a more user-friendly display
      const statusMap = {
        connecting: 'connecting',
        connected: 'connected',
        disconnected: 'disconnected'
      };
      
      // Update the status display
      setConnectionStatus(statusMap[event.status]);
      
      // Force reconnect if disconnected
      if (event.status === 'disconnected' && wsProvider.shouldConnect) {
        wsProvider.connect();
      }
    };

    // Add a ping interval to verify connection
    const pingInterval = setInterval(() => {
      if (wsProvider.wsconnected) {
        // Connection is actually working, force status update
        setConnectionStatus('connected');
      }
    }, 5000);

    wsProvider.on('status', handleStatus);
    
    // Set up awareness for client tracking with better deduplication
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().values());
      
      // Get unique users by clientID
      const uniqueUsers = [];
      const seenIds = new Set();
      
      states.forEach(state => {
        if (state.user && !seenIds.has(state.user.clientID)) {
          uniqueUsers.push(state.user);
          seenIds.add(state.user.clientID);
        }
      });
      
      setActiveUsers(uniqueUsers);
    });

    // Generate a random user ID and persist it in localStorage
    const generateUserId = () => {
      const storedId = localStorage.getItem('userId');
      if (storedId) return storedId;
      
      const newId = `User-${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('userId', newId);
      return newId;
    };

    const userId = generateUserId();
    
    // Set awareness state for current user
    awareness.setLocalStateField('user', {
      name: userId,
      clientID: awareness.clientID,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`,
      timestamp: Date.now()
    });

    // Properly clean up on unmount and page refresh
    const handleBeforeUnload = () => {
      // Immediately remove this client's state
      awarenessProtocol.removeAwarenessStates(
        awareness,
        [ydoc.clientID],
        'window unload'
      );
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      clearInterval(pingInterval);
      wsProvider.off('status', handleStatus);
      awareness.off('change');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Collaborative Rule Engine Designer</h1>
        <div className="connection-status">
          Status: <span className={connectionStatus}>{connectionStatus}</span>
        </div>
        <div className="active-users">
          {activeUsers.length > 0 ? (
            <div>
              <span>Active Users: </span>
              {activeUsers.map((user, index) => (
                <span key={user.clientID} style={{ color: user.color }}>
                  {user.name}{index < activeUsers.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          ) : (
            <span>No other users online</span>
          )}
        </div>
      </header>
      
      <main className="app-content">
        <ReactFlowProvider>
          <FlowDiagram />
        </ReactFlowProvider>
      </main>
    </div>
  );
};

export default App;