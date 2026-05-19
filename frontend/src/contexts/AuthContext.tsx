// Authentication context for managing user state

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
    user: User | null;
    profilePic: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    updateProfilePic: (base64: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // load profile pic from localStorage on mount and when user changes
    useEffect(() => {
        if (user) {
            const savedPic = localStorage.getItem(`profile_pic_${user.email}`);
            setProfilePic(savedPic);
        } else {
            setProfilePic(null);
        }
    }, [user]);

    const updateProfilePic = (base64: string | null) => {
        if (user) {
            if (base64) {
                localStorage.setItem(`profile_pic_${user.email}`, base64);
            } else {
                localStorage.removeItem(`profile_pic_${user.email}`);
            }
            setProfilePic(base64);
        }
    };

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const userData = await authApi.getProfile();
                    setUser(userData);
                } catch {
                    // Token invalid, clear it
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        await authApi.login({ email, password });
        const userData = await authApi.getProfile();
        setUser(userData);
    };

    const register = async (email: string, password: string, name: string) => {
        await authApi.register({ email, password, name });
        // Auto-login after registration
        await login(email, password);
    };

    const logout = () => {
        authApi.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                profilePic,
                isAuthenticated: !!user,
                isLoading,
                login,
                register,
                logout,
                updateProfilePic,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
