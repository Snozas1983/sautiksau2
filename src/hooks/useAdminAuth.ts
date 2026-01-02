import { useState, useCallback, useEffect } from 'react';

const ADMIN_SESSION_KEY = 'admin_session';

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check session on mount
  useEffect(() => {
    const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (session) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);
  
  const getPassword = useCallback((): string | null => {
    return sessionStorage.getItem(ADMIN_SESSION_KEY);
  }, []);
  
  const login = useCallback((password: string) => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, password);
    setIsAuthenticated(true);
  }, []);
  
  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
  }, []);
  
  return {
    isAuthenticated,
    isLoading,
    getPassword,
    login,
    logout,
  };
}
