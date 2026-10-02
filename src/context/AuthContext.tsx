import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Profile, UserRole } from '../types/inventory';
import { getSupabase } from '../lib/supabase';
import { getUsers } from '../lib/api';

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

  // Authenticate user strictly from Supabase Auth & profiles table
  // Flow: Supabase Auth user -> profiles.id -> profiles.role -> application permissions
  const fetchAuthenticatedProfile = useCallback(async (): Promise<Profile | null> => {
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !authUser) {
          return null;
        }

        // Query the authoritative database profile row (Note: email lives in auth.users)
        let { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active, created_at, updated_at')
          .eq('id', authUser.id)
          .maybeSingle();

        // If profile doesn't exist yet, auto-provision initial profile for the authenticated user
        if (!profileData && !profileError) {
          try {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const initialRole = count === 0 ? 'admin' : 'staff';
            const { data: created } = await supabase
              .from('profiles')
              .insert({
                id: authUser.id,
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                role: initialRole,
                is_active: true
              })
              .select('id, full_name, role, is_active, created_at, updated_at')
              .maybeSingle();

            if (created) profileData = created;
          } catch (e) {
            console.warn('Auto-provisioning profile failed:', e);
          }
        }

        if (profileData) {
          if (!profileData.is_active) {
            console.warn('User account is deactivated in Supabase profiles.');
            await supabase.auth.signOut();
            return null;
          }

          const rawRole = (profileData.role || 'staff').toString().toUpperCase();
          const verifiedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';

          const verifiedProfile: Profile = {
            id: profileData.id,
            full_name: profileData.full_name || authUser.email?.split('@')[0] || 'User',
            email: authUser.email || '',
            role: verifiedRole,
            is_active: true,
            created_at: profileData.created_at,
            updated_at: profileData.updated_at
          };

          return verifiedProfile;
        }
      } catch (err) {
        console.warn('Error verifying Supabase profile:', err);
      }
    }

    // Fallback: If running in offline test mode, verify against stored profiles table
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('stocksense_active_user_id') : null;
    if (storedUserId) {
      const allUsers = await getUsers();
      const matched = allUsers.find((u) => u.id === storedUserId && u.is_active);
      if (matched) {
        return matched;
      }
    }

    return null;
  }, []);

  // Initialize session on mount and listen to Supabase auth state changes
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
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const profile = await fetchAuthenticatedProfile();
          if (isMounted) setUser(profile);
        } else if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setUser(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('stocksense_active_user_id');
            }
          }
        }
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

    if (supabase && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (error) {
          setIsLoading(false);
          if (error.message?.toLowerCase().includes('email not confirmed')) {
            return {
              success: false,
              error: 'Email confirmation required. Please check your inbox to confirm your email, or disable "Confirm email" in Supabase Auth settings to log in immediately.'
            };
          }
          if (error.message?.toLowerCase().includes('invalid login credentials')) {
            return {
              success: false,
              error: 'Invalid email or password. Please verify your credentials or create an account.'
            };
          }
          return { success: false, error: error.message };
        }

        if (data.user) {
          // Strictly fetch role from profiles table (no email column)
          let { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_active, created_at, updated_at')
            .eq('id', data.user.id)
            .maybeSingle();

          // Auto-provision profile if row does not exist yet
          if (!profile) {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const initialRole = count === 0 ? 'admin' : 'staff';
            const { data: created } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
                role: initialRole,
                is_active: true
              })
              .select('id, full_name, role, is_active, created_at, updated_at')
              .maybeSingle();

            profile = created;
          }

          if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            setIsLoading(false);
            return { success: false, error: 'Your account has been deactivated. Please contact an Administrator.' };
          }

          const rawRole = (profile?.role || 'staff').toString().toUpperCase();
          const verifiedRole: UserRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';

          const authedProfile: Profile = {
            id: data.user.id,
            full_name: profile?.full_name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email || cleanEmail,
            role: verifiedRole,
            is_active: true,
            created_at: profile?.created_at || new Date().toISOString(),
            updated_at: profile?.updated_at || new Date().toISOString()
          };

          setUser(authedProfile);
          if (typeof window !== 'undefined') {
            localStorage.setItem('stocksense_active_user_id', authedProfile.id);
          }
          setIsLoading(false);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Supabase signIn error:', err);
      }
    }

    // Local / direct profile lookup for offline testing
    const allUsers = await getUsers();
    const matched = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (matched) {
      if (!matched.is_active) {
        setIsLoading(false);
        return { success: false, error: 'This user account is deactivated. Access denied.' };
      }

      setUser(matched);
      if (typeof window !== 'undefined') {
        localStorage.setItem('stocksense_active_user_id', matched.id);
      }
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return {
      success: false,
      error: 'Account not found. Please verify your credentials or register a new account.'
    };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const supabase = getSupabase();

    if (supabase) {
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

        if (data.user) {
          // If session was returned immediately (Confirm email is off)
          if (data.session) {
            let { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, role, is_active, created_at, updated_at')
              .eq('id', data.user.id)
              .maybeSingle();

            if (!profile) {
              const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
              const roleStr = count === 0 ? 'admin' : 'staff';
              const { data: created } = await supabase
                .from('profiles')
                .insert({
                  id: data.user.id,
                  full_name: fullName.trim(),
                  role: roleStr,
                  is_active: true
                })
                .select('id, full_name, role, is_active, created_at, updated_at')
                .maybeSingle();
              profile = created;
            }

            const rawRole = (profile?.role || 'staff').toString().toUpperCase();
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
            if (typeof window !== 'undefined') {
              localStorage.setItem('stocksense_active_user_id', newProfile.id);
            }
            setIsLoading(false);
            return { success: true };
          } else {
            // Email confirmation is required by Supabase project settings
            setIsLoading(false);
            return {
              success: true,
              error: 'Account created! Please check your email to confirm registration before signing in.'
            };
          }
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || 'Registration failed.' };
      }
    }

    // Local account registration fallback
    const allUsers = await getUsers();
    if (allUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      setIsLoading(false);
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const assignedRole: UserRole = allUsers.length === 0 ? 'ADMIN' : 'STAFF';

    const newProfile: Profile = {
      id: 'user-' + Date.now(),
      full_name: fullName.trim(),
      email: cleanEmail,
      role: assignedRole,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    allUsers.push(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('stocksense_db_users', JSON.stringify(allUsers));
      localStorage.setItem('stocksense_active_user_id', newProfile.id);
    }

    setUser(newProfile);
    setIsLoading(false);
    return { success: true };
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('stocksense_active_user_id');
      localStorage.removeItem('stocksense_current_user');
    }
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
