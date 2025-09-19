import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getCurrentUser } from '../services/authApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('user_info');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid
          const userInfo = await getCurrentUser(storedToken);
          setToken(storedToken);
          setUser(userInfo);
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_info');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = (newToken: string, userInfo: User) => {
    setToken(newToken);
    setUser(userInfo);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('user_info', JSON.stringify(userInfo));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    
    // Clear all app-related localStorage data
    try {
      localStorage.removeItem('law_entries');
      localStorage.removeItem('team_progress');
      localStorage.removeItem('daily_quotas');
      localStorage.removeItem('kb_entry_draft');
      localStorage.removeItem('kb_draft');
      localStorage.removeItem('kb_drafts');
      localStorage.removeItem('importedEntryData');
      localStorage.removeItem('cameFromDashboard');
      
      // Clear any other app-related keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('kb_entry_') || 
            key.startsWith('entry_draft_') || 
            key.startsWith('kb_draft') ||
            key.includes('draft') ||
            key.includes('autosave')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('🧹 Cleared all app data on logout');
    } catch (e) {
      console.warn('Failed to clear app data on logout:', e);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
