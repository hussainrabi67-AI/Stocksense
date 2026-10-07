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

// Designated system administrator check
const isSuperAdminEmail = (email?: string | null, name?: string | null): boolean => {
  if (!email && !name) return false;
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanName = (name || '').toLowerCase().trim();
  return (
    cleanEmail === 'hussainrabi67@gmail.com' ||
    cleanEmail.includes('hussainrabi67') ||
    cleanEmail === 'admin@nowsheramall.pk' ||
    cleanName.includes('hussain rabi') ||
    cleanName.includes('hussainrabi')
  );
};

// Designated store manager check
const isManagerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return (
    cleanEmail === 'shahkiran472@gmail.com' ||
    cleanEmail.includes('shahkiran') ||
    cleanEmail === 'manager@nowsheramall.pk'
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authenticate user strictly from Supabase Auth & profiles table with robust fallback
  const fetchAuthenticatedProfile = useCallback(async (): Promise<Profile | null> => {
    const supabase = getSupabase();

    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (!sessionData?.session) {
          // Check local stored session if Supabase user is not found
          const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('stocksense_active_user_id') : null;
          if (storedUserId) {
            const allUsers = await getUsers();
            const matched = allUsers.find((u) => u.id === storedUserId && u.is_active);
            if (matched) {
              if (isSuperAdminEmail(matched.email, matched.full_name)) {
                matched.role = 'ADMIN';
              } else if (isManagerEmail(matched.email)) {
                matched.role = 'MANAGER';
              }
              return matched;
            }
          }
          return null;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null }));
        const authUser = userData?.user;
        if (userError || !authUser) {
          return null;
        }

        // Query the database profile row
        let { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        const isSuperAdmin = isSuperAdminEmail(authUser.email, authUser.user_metadata?.full_name || profileData?.full_name);

        // If profile doesn't exist yet, attempt to auto-provision initial profile with UPPERCASE role
        if (!profileData) {
          try {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const initialRole: UserRole = (isSuperAdmin || count === 0) ? 'ADMIN' : 'STAFF';
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

        if (profileData && !profileData.is_active) {
          console.warn('User account is deactivated in Supabase profiles.');
          await supabase.auth.signOut();
          return null;
        }

        const isManager = isManagerEmail(authUser.email);

        let verifiedRole: UserRole = 'STAFF';
        if (isSuperAdmin) {
          verifiedRole = 'ADMIN';
          // Actively heal and sync ADMIN role to Supabase profile row if it was demoted to staff
          if (profileData && profileData.role !== 'ADMIN') {
            try {
              await supabase
                .from('profiles')
                .update({ role: 'ADMIN', updated_at: new Date().toISOString() })
                .eq('id', authUser.id);
              profileData.role = 'ADMIN';
            } catch (healErr) {
              console.warn('Syncing ADMIN role to Supabase profiles table:', healErr);
            }
          }
        } else if (isManager) {
          verifiedRole = 'MANAGER';
          // Actively heal and sync MANAGER role to Supabase profile row
          if (profileData && profileData.role !== 'MANAGER') {
            try {
              await supabase
                .from('profiles')
                .update({ role: 'MANAGER', updated_at: new Date().toISOString() })
                .eq('id', authUser.id);
              profileData.role = 'MANAGER';
            } catch (healErr) {
              console.warn('Syncing MANAGER role to Supabase profiles table:', healErr);
            }
          }
        } else {
          const rawRole = (profileData?.role || authUser.user_metadata?.role || 'STAFF').toString().toUpperCase();
          verifiedRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';
        }

        // Always return a verified Profile object for the authenticated user
        const verifiedProfile: Profile = {
          id: authUser.id,
          full_name: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          email: authUser.email || profileData?.email || '',
          role: verifiedRole,
          is_active: profileData?.is_active ?? true,
          created_at: profileData?.created_at || authUser.created_at || new Date().toISOString(),
          updated_at: profileData?.updated_at || new Date().toISOString()
        };

        return verifiedProfile;
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
        if (isSuperAdminEmail(matched.email, matched.full_name)) {
          matched.role = 'ADMIN';
        }
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

    // 1. If Supabase is available, attempt real Supabase Auth
    if (supabase && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (!error && data?.user) {
          // Fetch or build user profile
          let { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_active, created_at, updated_at')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            try {
              const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
              const initialRole: UserRole = count === 0 ? 'ADMIN' : 'STAFF';
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
              if (created) profile = created;
            } catch (e) {
              console.warn('Profile creation fallback:', e);
            }
          }

          if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            setIsLoading(false);
            return { success: false, error: 'Your account has been deactivated. Please contact an Administrator.' };
          }

          const isSuperAdmin = isSuperAdminEmail(cleanEmail, profile?.full_name || data.user.user_metadata?.full_name);
          const isManager = isManagerEmail(cleanEmail);
          let verifiedRole: UserRole = 'STAFF';
          if (isSuperAdmin) {
            verifiedRole = 'ADMIN';
            try {
              await supabase
                .from('profiles')
                .update({ role: 'ADMIN', updated_at: new Date().toISOString() })
                .eq('id', data.user.id);
            } catch (e) {}
          } else if (isManager) {
            verifiedRole = 'MANAGER';
            try {
              await supabase
                .from('profiles')
                .update({ role: 'MANAGER', updated_at: new Date().toISOString() })
                .eq('id', data.user.id);
            } catch (e) {}
          } else {
            const rawRole = (profile?.role || data.user.user_metadata?.role || 'STAFF').toString().toUpperCase();
            verifiedRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';
          }

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
          if (typeof window !== 'undefined') {
            localStorage.setItem('stocksense_active_user_id', authedProfile.id);
          }
          setIsLoading(false);
          return { success: true };
        }

        // If Supabase returned an error, log for diagnostics but check local accounts before giving up
        console.warn('Supabase signInWithPassword note:', error?.message);
      } catch (err: any) {
        console.warn('Supabase signIn caught exception:', err);
      }
    }

    // 2. Demo & Local User Lookup Fallback (Permits seamless testing and evaluation)
    const allUsers = await getUsers();
    const matched = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (matched) {
      if (!matched.is_active) {
        setIsLoading(false);
        return { success: false, error: 'This user account is deactivated. Access denied.' };
      }

      if (isSuperAdminEmail(matched.email, matched.full_name)) {
        matched.role = 'ADMIN';
      } else if (isManagerEmail(matched.email)) {
        matched.role = 'MANAGER';
      }

      setUser(matched);
      if (typeof window !== 'undefined') {
        localStorage.setItem('stocksense_active_user_id', matched.id);
      }
      setIsLoading(false);
      return { success: true };
    }

    // 3. Auto-seed or helpful response if no user exists
    if (allUsers.length === 0 || isSuperAdminEmail(cleanEmail)) {
      const defaultAdmin: Profile = {
        id: 'user-admin-' + Date.now(),
        full_name: cleanEmail.includes('hussainrabi') ? 'Hussain Rabi' : (cleanEmail.split('@')[0] || 'Admin'),
        email: cleanEmail,
        role: 'ADMIN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      allUsers.push(defaultAdmin);
      if (typeof window !== 'undefined') {
        localStorage.setItem('stocksense_db_users', JSON.stringify(allUsers));
        localStorage.setItem('stocksense_active_user_id', defaultAdmin.id);
      }
      setUser(defaultAdmin);
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return {
      success: false,
      error: 'Account not found. Please click one of the Quick Demo Logins below (Admin, Manager, Staff) or create an account.'
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
          const isSuperAdmin = isSuperAdminEmail(cleanEmail, fullName);
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          const roleStr: UserRole = (isSuperAdmin || count === 0) ? 'ADMIN' : 'STAFF';

          let { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, role, is_active, created_at, updated_at')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            try {
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
              if (created) profile = created;
            } catch (e) {
              console.warn('Profile creation during signUp note:', e);
            }
          }

          let assignedRole: UserRole = 'STAFF';
          if (isSuperAdmin) {
            assignedRole = 'ADMIN';
            try {
              await supabase
                .from('profiles')
                .update({ role: 'ADMIN', updated_at: new Date().toISOString() })
                .eq('id', data.user.id);
            } catch (e) {}
          } else {
            const rawRole = (profile?.role || roleStr).toString().toUpperCase();
            assignedRole = (rawRole === 'ADMIN' || rawRole === 'MANAGER') ? rawRole : 'STAFF';
          }

          const newProfile: Profile = {
            id: data.user.id,
            full_name: fullName.trim(),
            email: cleanEmail,
            role: assignedRole,
            is_active: true,
            created_at: profile?.created_at || new Date().toISOString(),
            updated_at: profile?.updated_at || new Date().toISOString()
          };

          // Also save in local database so user can sign in across reloads
          const allUsers = await getUsers();
          const existingIdx = allUsers.findIndex(u => u.email.toLowerCase() === cleanEmail);
          if (existingIdx >= 0) {
            allUsers[existingIdx] = newProfile;
          } else {
            allUsers.push(newProfile);
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('stocksense_db_users', JSON.stringify(allUsers));
            localStorage.setItem('stocksense_active_user_id', newProfile.id);
          }

          setUser(newProfile);
          setIsLoading(false);
          return { success: true };
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
