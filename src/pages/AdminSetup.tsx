import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { RoleManager } from "@/components/admin/RoleManager";
import { ShieldCheck, Loader2, LogOut, AlertTriangle } from "lucide-react";

const GOOGLE_SVG = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// The designated owner email — set VITE_ADMIN_EMAIL in your .env file.
// If not set, the first person to sign in can claim admin (bootstrap only).
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

type PageState =
  | "loading"
  | "sign-in"          // not authenticated
  | "wrong-account"    // signed in but not the owner email
  | "bootstrap"        // owner email, no admins exist yet
  | "already-admin"    // signed in, is admin
  | "not-authorized";  // admins exist but this user is not one

export const AdminSetup = () => {
  const { user, isAdmin, signInWithOAuth, signOut, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    resolvePageState();
  }, [authLoading, user, isAdmin]);

  const resolvePageState = async () => {
    if (!user) {
      setPageState("sign-in");
      return;
    }

    // Check if any admin exists in the system
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    const hasAdmin = (count ?? 0) > 0;
    setAdminExists(hasAdmin);

    // If user is already admin, show the role manager
    if (isAdmin) {
      setPageState("already-admin");
      return;
    }

    // If VITE_ADMIN_EMAIL is set, enforce it
    if (ADMIN_EMAIL && user.email !== ADMIN_EMAIL) {
      setPageState("wrong-account");
      return;
    }

    // No admins exist — allow this user to bootstrap
    if (!hasAdmin) {
      setPageState("bootstrap");
      return;
    }

    // Admins exist but this user isn't one
    setPageState("not-authorized");
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin-setup` },
    });
    if (error) {
      toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
      setOauthLoading(false);
    }
  };

  const handleClaimAdmin = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_first_admin" as any);

    if (error) {
      toast({ title: "Failed to claim admin", description: error.message, variant: "destructive" });
      setClaiming(false);
      return;
    }

    if (data === false) {
      toast({
        title: "Admins already exist",
        description: "Another admin must grant you access.",
        variant: "destructive",
      });
      setClaiming(false);
      await resolvePageState();
      return;
    }

    toast({ title: "Admin access granted", description: "You are now the system admin." });
    // Re-fetch auth state — roles will reload on next auth event
    window.location.reload();
  };

  const handleSignOut = async () => {
    await signOut();
    setPageState("sign-in");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <Logo size="lg" />
          {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          )}
        </div>

        {/* Loading */}
        {(pageState === "loading" || authLoading) && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Not signed in */}
        {pageState === "sign-in" && (
          <div className="bg-card rounded-2xl border border-border p-10 text-center space-y-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Admin Setup</h1>
              <p className="text-muted-foreground text-sm">
                Sign in with your dedicated Google admin account to manage roles.
              </p>
              {ADMIN_EMAIL && (
                <p className="text-xs text-muted-foreground mt-2">
                  Only <span className="font-mono">{ADMIN_EMAIL}</span> may access this page.
                </p>
              )}
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              size="lg"
              disabled={oauthLoading}
              onClick={handleGoogleSignIn}
            >
              {oauthLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                GOOGLE_SVG
              )}
              Sign in with Google
            </Button>
          </div>
        )}

        {/* Wrong Google account */}
        {pageState === "wrong-account" && (
          <div className="bg-card rounded-2xl border border-destructive/30 p-10 text-center space-y-4 max-w-md mx-auto">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Wrong account</h1>
            <p className="text-muted-foreground text-sm">
              You signed in as <span className="font-medium">{user?.email}</span>, but this setup
              page requires <span className="font-mono text-xs">{ADMIN_EMAIL}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Sign out and try again with the correct Google account.
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}

        {/* Bootstrap — no admin exists yet */}
        {pageState === "bootstrap" && (
          <div className="bg-card rounded-2xl border border-border p-10 text-center space-y-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Claim Admin Access</h1>
              <p className="text-muted-foreground text-sm">
                No admin account exists yet. You are signed in as{" "}
                <span className="font-medium">{user?.email}</span>.
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Click below to become the system administrator.
              </p>
            </div>
            <Button
              variant="hero"
              size="lg"
              className="w-full gap-2"
              onClick={handleClaimAdmin}
              disabled={claiming}
            >
              {claiming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              Claim Admin Access
            </Button>
          </div>
        )}

        {/* Already admin — show role manager */}
        {pageState === "already-admin" && (
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-3 mb-1">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Role Management</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium">{user?.email}</span> (admin)
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6">
              <RoleManager />
            </div>
          </div>
        )}

        {/* Not authorized */}
        {pageState === "not-authorized" && (
          <div className="bg-card rounded-2xl border border-border p-10 text-center space-y-4 max-w-md mx-auto">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground text-sm">
              You are signed in as <span className="font-medium">{user?.email}</span> but do not
              have admin privileges. Ask an existing admin to grant you access.
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;
