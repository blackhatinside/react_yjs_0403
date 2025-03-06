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

    // Generate a persistent user ID for this browser
    const getBrowserId = () => {
      let browserId = localStorage.getItem('ruleBrowserId');
      if (!browserId) {
        browserId = `browser-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
        localStorage.setItem('ruleBrowserId', browserId);
      }
      return browserId;
    };

    // Get user info with consistent ID per browser but unique name per tab
    const getUserInfo = () => {
      const browserId = getBrowserId();
      const tabId = `tab-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
      
      // Get or create a username that's consistent for this browser
      let userName = localStorage.getItem('ruleUserName');
      if (!userName) {
        userName = `User-${Math.floor(Math.random() * 1000)}`;
        localStorage.setItem('ruleUserName', userName);
      }
      
      return {
        clientID: ydoc.clientID,
        browserId: browserId,
        tabId: tabId,
        name: userName,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
      };
    };

    // Set user state only once per document instance
    const userInfo = getUserInfo();
    awareness.setLocalState({ user: userInfo });

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
    <ReactFlowProvider>
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
          <FlowDiagram />
        </main>
      </div>
    </ReactFlowProvider>
  );
};

export default App;