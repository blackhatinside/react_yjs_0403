import React, { useEffect, useState } from 'react';
import { ydoc, awareness, wsProvider } from './yjsSetup';
import FlowDiagram from './components/FlowDiagram';
import './App.css';

const App = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    // Set up connection status monitoring
    wsProvider.on('status', event => {
      setConnectionStatus(event.status);
    });

    // Set up awareness for client tracking
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().values());
      setActiveUsers(states.filter(state => state.user).map(state => state.user));
    });

    // Get saved user info or create new one
    const getUserInfo = () => {
      const savedUser = localStorage.getItem('collaborativeUserInfo');
      
      if (savedUser) {
        return JSON.parse(savedUser);
      } else {
        // Create new user info
        const userInfo = {
          id: ydoc.clientID,
          name: `User-${Math.floor(Math.random() * 1000)}`,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`
        };
        
        // Save to localStorage for future sessions
        localStorage.setItem('collaborativeUserInfo', JSON.stringify(userInfo));
        return userInfo;
      }
    };

    // Set local user state with persistent identity
    const userInfo = getUserInfo();
    awareness.setLocalState({
      user: userInfo
    });

    // Cleanup
    return () => {
      wsProvider.off('status');
      awareness.off('change');
      awareness.setLocalState(null);
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
                <span key={index} style={{ color: user.color }}>
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
  );
};

export default App;