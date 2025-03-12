import React from 'react';
import { getUsers, getCurrentRoom } from '../yjsSetup';

const Header = ({ onSwitchRoom }) => {
  const users = getUsers();
  const roomName = getCurrentRoom();

  return (
    <header className="app-header">
      <div className="app-title">
        Collaborative Rule Engine Designer - Room: {roomName}
      </div>
      <div className="user-info">
        <span>
          {users.length > 1 
            ? `${users.length - 1} other users online` 
            : "No other users online"}
        </span>
        <button onClick={onSwitchRoom} className="room-switch-btn">
          Switch Room
        </button>
      </div>
    </header>
  );
};

export default Header; 