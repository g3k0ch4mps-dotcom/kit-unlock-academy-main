import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, ShieldCheck, BookOpen, User } from "lucide-react";

type AppRole = "admin" | "instructor" | "learner";

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
}

const ROLE_META: Record<AppRole, { label: string; color: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin",
    color: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  instructor: {
    label: "Instructor (Trainer)",
    color: "bg-primary/10 text-primary border-primary/30",
    icon: <BookOpen className="h-3 w-3" />,
  },
  learner: {
    label: "Learner",
    color: "bg-muted text-muted-foreground border-border",
    icon: <User className="h-3 w-3" />,
  },
};

export const RoleManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, full_name").order("email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const roleMap = new Map<string, AppRole>();
    for (const r of roles ?? []) {
      roleMap.set(r.user_id, r.role as AppRole);
    }

    const merged: UserWithRole[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      email: p.email,
      full_name: p.full_name,
      role: roleMap.get(p.user_id) ?? "learner",
    }));

    setUsers(merged);
    setIsLoading(false);
  };

  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    setSaving(targetUserId);

    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: targetUserId,
      new_role: newRole,
    } as any);

    if (error) {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.user_id === targetUserId ? { ...u, role: newRole } : u))
      );
      const name = users.find((u) => u.user_id === targetUserId)?.full_name ?? "User";
      toast({
        title: "Role updated",
        description: `${name} is now ${ROLE_META[newRole].label}.`,
      });
    }

    setSaving(null);
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.full_name?.toLowerCase() ?? "").includes(q);
  });

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Each user has exactly one role. Admin and Instructor cannot be combined.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {(["admin", "instructor", "learner"] as AppRole[]).map((r) => {
          const count = users.filter((u) => u.role === r).length;
          return (
            <span key={r} className="flex items-center gap-1">
              <Badge variant="outline" className={`text-xs ${ROLE_META[r].color}`}>
                {ROLE_META[r].label}
              </Badge>
              {count}
            </span>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>User</span>
          <span>Role</span>
        </div>

        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? "No users match your search." : "No users found."}
            </div>
          ) : (
            filtered.map((u) => {
              const isSelf = u.user_id === user?.id;
              const isSelfAndLastAdmin = isSelf && u.role === "admin" && adminCount <= 1;

              return (
                <div
                  key={u.user_id}
                  className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary">
                      {(u.full_name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{u.full_name || "Unnamed"}</p>
                        {isSelf && (
                          <Badge variant="outline" className="text-xs shrink-0">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {saving === u.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(val) => handleRoleChange(u.user_id, val as AppRole)}
                        disabled={isSelfAndLastAdmin}
                      >
                        <SelectTrigger
                          className={`w-44 text-xs h-8 ${ROLE_META[u.role].color} border`}
                          title={
                            isSelfAndLastAdmin
                              ? "Cannot demote yourself — you are the only admin"
                              : undefined
                          }
                        >
                          <span className="flex items-center gap-1.5">
                            {ROLE_META[u.role].icon}
                            <SelectValue />
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <ShieldCheck className="h-3.5 w-3.5 text-destructive" />
                              Admin
                            </span>
                          </SelectItem>
                          <SelectItem value="instructor">
                            <span className="flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 text-primary" />
                              Instructor (Trainer)
                            </span>
                          </SelectItem>
                          <SelectItem value="learner">
                            <span className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              Learner
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {adminCount === 0 && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No admin account exists. Go to /admin-setup to claim admin access.
        </div>
      )}
    </div>
  );
};

export default RoleManager;
