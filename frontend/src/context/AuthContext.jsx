import { createContext, useContext, useEffect, useState } from "react";

import { getAuthMe, loginUser, registerUser } from "../api/auth.api";

import { getUserMe } from "../api/user.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);

  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);

  async function loadSession() {
    const token = localStorage.getItem("cpbot_access_token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [auth, userProfile] = await Promise.all([getAuthMe(), getUserMe()]);

      setAuthUser(auth);
      setProfile(userProfile);
    } catch {
      localStorage.removeItem("cpbot_access_token");

      setAuthUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function login(payload) {
    const result = await loginUser(payload);

    localStorage.setItem("cpbot_access_token", result.accessToken);

    const [auth, userProfile] = await Promise.all([getAuthMe(), getUserMe()]);

    setAuthUser(auth);
    setProfile(userProfile);
  }

  async function register(payload) {
    const result = await registerUser(payload);

    localStorage.setItem("cpbot_access_token", result.accessToken);

    setAuthUser(result.user);

    const userProfile = await getUserMe();

    setProfile(userProfile);
  }

  function logout() {
    localStorage.removeItem("cpbot_access_token");

    setAuthUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    const userProfile = await getUserMe();

    setProfile(userProfile);
  }

  return (
    <AuthContext.Provider
      value={{
        authUser,
        profile,
        loading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
