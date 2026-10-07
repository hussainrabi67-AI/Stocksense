import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole } from '../types/inventory';
import { getSupabase } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAuthenticatedProfile = useCallback(async (): Promise<Profile | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) return null;

      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!profileData) {
        try {
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
              email: authUser.email,
              role: 'STAFF',
              is_active: true
            })
            .select('*')
            .maybeSingle();

          if (created) profileData = created;
        } catch (e) {
          console.warn('Auto-provisioning profile failed:', e);
        }
      }

      if (profileData && !profileData.is_active) {
        await supabase.auth.signOut();
        return null;
      }

      const rawRole = (profileData?.role || 'STAFF').toString().toUpperCase();
      const verifiedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';

      return {
        id: authUser.id,
        full_name: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || profileData?.email || '',
        role: verifiedRole,
        is_active: profileData?.is_active ?? true,
        created_at: profileData?.created_at || authUser.created_at || new Date().toISOString(),
        updated_at: profileData?.updated_at || new Date().toISOString()
      };
    } catch (err) {
      console.warn('Error verifying Supabase profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsLoading(true);
      const profile = await fetchAuthenticatedProfile();
      if (isMounted) {
        setUser(profile);
        setIsLoading(false);
      }
    }

    initSession();

    const supabase = getSupabase();
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        (async () => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const profile = await fetchAuthenticatedProfile();
            if (isMounted) setUser(profile);
          } else if (event === 'SIGNED_OUT') {
            if (isMounted) setUser(null);
          }
        })();
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [fetchAuthenticatedProfile]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoading(false);
      return { success: false, error: 'Database is not configured. Please contact your administrator.' };
    }

    if (!password) {
      setIsLoading(false);
      return { success: false, error: 'Password is required.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        setIsLoading(false);
        return { success: false, error: 'Login failed: no user returned.' };
      }

      let { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at, updated_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        try {
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email,
              role: 'STAFF',
              is_active: true
            })
            .select('id, full_name, email, role, is_active, created_at, updated_at')
            .maybeSingle();
          if (created) profile = created;
        } catch (e) {
          console.warn('Profile creation during login:', e);
        }
      }

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        setIsLoading(false);
        return { success: false, error: 'Your account has been deactivated. Please contact an Administrator.' };
      }

      const rawRole = (profile?.role || 'STAFF').toString().toUpperCase();
      const verifiedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';

      const authedProfile: Profile = {
        id: data.user.id,
        full_name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
        email: data.user.email || cleanEmail,
        role: verifiedRole,
        is_active: true,
        created_at: profile?.created_at || new Date().toISOString(),
        updated_at: profile?.updated_at || new Date().toISOString()
      };

      setUser(authedProfile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Login failed. Please check your credentials.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const supabase = getSupabase();

    if (!supabase) {
      setIsLoading(false);
      return { success: false, error: 'Database is not configured. Please contact your administrator.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        setIsLoading(false);
        return { success: false, error: 'Sign up failed: no user returned.' };
      }

      let { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at, updated_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        try {
          const { data: created } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName.trim(),
              email: cleanEmail,
              role: 'STAFF',
              is_active: true
            })
            .select('id, full_name, email, role, is_active, created_at, updated_at')
            .maybeSingle();
          if (created) profile = created;
        } catch (e) {
          console.warn('Profile creation during signUp:', e);
        }
      }

      const rawRole = (profile?.role || 'STAFF').toString().toUpperCase();
      const assignedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';

      const newProfile: Profile = {
        id: data.user.id,
        full_name: fullName.trim(),
        email: cleanEmail,
        role: assignedRole,
        is_active: true,
        created_at: profile?.created_at || new Date().toISOString(),
        updated_at: profile?.updated_at || new Date().toISOString()
      };

      setUser(newProfile);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    setUser(null);
  };

  const refreshUser = async () => {
    const freshProfile = await fetchAuthenticatedProfile();
    setUser(freshProfile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'STAFF',
        isAuthenticated: Boolean(user && user.is_active),
        isLoading,
        login,
        signUp,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
