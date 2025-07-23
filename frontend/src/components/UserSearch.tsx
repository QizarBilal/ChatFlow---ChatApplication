import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  isOnline: boolean;
  mobile?: string;
  isBot?: boolean;
}

interface UserSearchProps {
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

const UserSearch: React.FC<UserSearchProps> = ({ onSelectUser, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Load all users when component mounts
    const loadAllUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/users`);
        setAllUsers(response.data);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadAllUsers();
  }, [API_BASE_URL]);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults(allUsers.slice(0, 10)); // Show first 10 users when no query
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/search/users?query=${encodeURIComponent(query)}`);
        setResults(response.data);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, API_BASE_URL, allUsers]);

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="user-search-overlay">
      <div className="user-search-modal">
        <div className="user-search-header">
          <h3>Find Users</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, email, or mobile number..."
            className="search-input"
            autoFocus
          />
          {loading && <div className="search-loading">Searching...</div>}
        </div>

        <div className="user-results">
          {results.length === 0 && query.length >= 2 && !loading && (
            <div className="no-results">No users found matching your search</div>
          )}
          
          {results.map((user) => (
            <div
              key={user.id}
              className="user-result-item"
              onClick={() => handleSelectUser(user)}
            >
              <div className="user-avatar">
                {user.avatar || '👤'}
                {user.isOnline && <div className="online-indicator"></div>}
              </div>
              <div className="user-info">
                <div className="user-name">
                  {user.username}
                  {user.isBot && <span className="bot-badge">🤖 Bot</span>}
                </div>
                <div className="user-details">
                  {user.email}
                  {user.mobile && <span className="mobile">📱 {user.mobile}</span>}
                </div>
              </div>
              <div className="user-status">
                {user.isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserSearch;
