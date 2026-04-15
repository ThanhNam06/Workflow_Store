import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router';

interface User {
  id?: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('workflowstore_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    // Optional: validate token on mount
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    localStorage.setItem('workflowstore_token', data.token);
    localStorage.setItem('workflowstore_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('workflowstore_token');
    localStorage.removeItem('workflowstore_user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: user !== null
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
