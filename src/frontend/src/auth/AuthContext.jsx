import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { Loader2 } from 'lucide-react';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocalDev ? 'http://localhost:8000' : '';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authChecking, setAuthChecking] = useState(false);
    const [authError, setAuthError] = useState(null);

    const isLocal = isLocalDev;

    useEffect(() => {
        if (isLocal) {
            setUser({
                uid: 'local-dev-user',
                email: 'dev@localhost',
                displayName: 'Local Developer',
                photoURL: null
            });
            setIsAuthorized(true);
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setAuthError(null);

            if (currentUser) {
                setAuthChecking(true);
                try {
                    const idToken = await currentUser.getIdToken();
                    setToken(idToken);

                    const response = await fetch(`${API_URL}/api/auth-check`, {
                        headers: {
                            'Authorization': `Bearer ${idToken}`
                        }
                    });

                    const data = await response.json();

                    if (data.authorized) {
                        setIsAuthorized(true);
                    } else {
                        setIsAuthorized(false);
                        setAuthError(data.reason || 'Not authorized');
                    }
                } catch (error) {
                    console.error("Auth check failed:", error);
                    setIsAuthorized(false);
                    setAuthError('Failed to verify authorization');
                }
                setAuthChecking(false);
            } else {
                setToken(null);
                setIsAuthorized(false);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [isLocal]);

    const login = async () => {
        if (isLocal) return; // No-op locally
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        if (isLocal) {
            alert("Logout not available in local dev mode");
            return;
        }
        try {
            await signOut(auth);
            setIsAuthorized(false);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const value = {
        user,
        token,
        login,
        logout,
        isLocal,
        isAuthorized,
        authChecking,
        authError
    };

    if (loading || authChecking) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-emerald-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
