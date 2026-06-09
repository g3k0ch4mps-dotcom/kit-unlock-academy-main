import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

interface UserRole {
  role: "admin" | "instructor" | "learner";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isInstructor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: "google" | "github") => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener BEFORE getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: rolesData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id);

            if (!rolesData || rolesData.length === 0) {
              // Profile/role missing — likely after a DB reset. Self-heal via RPC.
              await supabase.rpc("ensure_user_profile" as any);
              const { data: healed } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id);
              setRoles((healed as UserRole[]) || []);
            } else {
              setRoles((rolesData as UserRole[]) || []);
            }
          }, 0);
        } else {
          setRoles([]);
        }

        setIsLoading(false);

        // Clean the OAuth hash out of the URL only AFTER Supabase has parsed it
        // and established the session (i.e. on the SIGNED_IN event). Clearing it
        // any earlier deletes the token before detectSessionInUrl can read it.
        // Supabase strips the token itself but leaves a bare "#", so remove any
        // leftover hash here too.
        if (event === "SIGNED_IN" && window.location.hash) {
          window.history.replaceState({}, "", window.location.pathname + window.location.search);
        }
      }
    );

    if (session?.user) {
      recordDeviceFingerprint(session.user.id);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        recordDeviceFingerprint(session.user.id);
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .then(async ({ data: rolesData }) => {
            if (!rolesData || rolesData.length === 0) {
              await supabase.rpc("ensure_user_profile" as any);
              const { data: healed } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id);
              setRoles((healed as UserRole[]) || []);
            } else {
              setRoles((rolesData as UserRole[]) || []);
            }
          });
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-check device revocation when the user refocuses the tab, so a revoked
  // device is signed out within seconds instead of only at next login/reload.
  useEffect(() => {
    if (!user) return;
    const recheck = async () => {
      try {
        const fp = await FingerprintJS.load();
        const { visitorId } = await fp.get();
        const { data } = await supabase
          .from("user_devices")
          .select("is_revoked")
          .eq("user_id", user.id)
          .eq("fingerprint", visitorId)
          .maybeSingle();
        if (data?.is_revoked) {
          toast({
            title: "Device access revoked",
            description: "Access from this device has been revoked by an administrator.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setRoles([]);
        }
      } catch {
        /* ignore transient fingerprint/network errors */
      }
    };
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [user]);

  const recordDeviceFingerprint = async (userId: string) => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const fingerprint = result.visitorId;

      const { data: existing } = await supabase
        .from("user_devices")
        .select("id, sign_in_count, is_revoked")
        .eq("user_id", userId)
        .eq("fingerprint", fingerprint)
        .maybeSingle();

      // Enforce admin revocation: a revoked device cannot use the platform
      if (existing?.is_revoked) {
        toast({
          title: "Device access revoked",
          description: "Access from this device has been revoked by an administrator.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRoles([]);
        return;
      }

      if (existing) {
        await supabase
          .from("user_devices")
          .update({
            last_sign_in_at: new Date().toISOString(),
            sign_in_count: (existing.sign_in_count || 0) + 1,
          })
          .eq("id", existing.id);
      } else {
        const ua = navigator.userAgent;
        let deviceLabel = "Unknown device";
        if (/mobile|android|iphone/i.test(ua)) deviceLabel = "Mobile";
        else if (/tablet|ipad/i.test(ua)) deviceLabel = "Tablet";
        else deviceLabel = `Desktop (${/windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other"})`;

        await supabase.from("user_devices").insert({
          user_id: userId,
          fingerprint,
          device_label: deviceLabel,
          last_sign_in_at: new Date().toISOString(),
          sign_in_count: 1,
        });
      }
    } catch (err) {
      console.error("Device fingerprint error:", err);
      toast({ title: "Device tracking error", description: "Unable to record device for security.", variant: "destructive" });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const isAdmin = roles.some((r) => r.role === "admin");
  const isInstructor = roles.some((r) => r.role === "instructor");

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        isLoading,
        isAdmin,
        isInstructor,
        signIn,
        signUp,
        signOut,
        resetPassword,
        signInWithOAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
