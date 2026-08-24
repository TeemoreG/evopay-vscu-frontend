import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [tin, setTin] = useState('');
  const [bhfId, setBhfId] = useState('');
  const [dvcSrlNo, setDvcSrlNo] = useState('');
  const [cmcKey, setCmcKey] = useState('');
  const [user, setUser] = useState(null); // Add user state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on app load
    const storedTin = localStorage.getItem('tin');
    const storedBhfId = localStorage.getItem('bhfId');
    const storedCmcKey = localStorage.getItem('cmcKey');
    const storedUser = localStorage.getItem('user');

    if (storedTin && storedBhfId && storedCmcKey) {
      setTin(storedTin);
      setBhfId(storedBhfId);
      setCmcKey(storedCmcKey);
      setIsAuthenticated(true);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }

    setLoading(false);
  }, []);

  const login = (tin, bhfId, dvcSrlNo, cmcKey, userData = null) => {
    setTin(tin);
    setBhfId(bhfId);
    setDvcSrlNo(dvcSrlNo);
    setCmcKey(cmcKey);
    setIsAuthenticated(true);

    localStorage.setItem('tin', tin);
    localStorage.setItem('bhfId', bhfId);
    localStorage.setItem('dvcSrlNo', dvcSrlNo);
    localStorage.setItem('cmcKey', cmcKey);

    if (userData) {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  const setUserInfo = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setTin('');
    setBhfId('');
    setDvcSrlNo('');
    setCmcKey('');
    setUser(null);
    setIsAuthenticated(false);

    localStorage.clear();
  };

  const value = {
    tin,
    bhfId,
    dvcSrlNo,
    cmcKey,
    user,                // Current cashier/user info
    isAuthenticated,
    loading,
    login,
    logout,
    setUserInfo,        // Update user info after login
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};