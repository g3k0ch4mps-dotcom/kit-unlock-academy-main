import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldOff, Loader2, Monitor, Smartphone, Tablet } from "lucide-react";

interface UserDevice {
  id: string;
  user_id: string;
  fingerprint: string;
  device_label: string;
  ip_address: string | null;
  last_sign_in_at: string;
  sign_in_count: number;
  is_revoked: boolean;
  created_at: string;
}

interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
}

const deviceIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("mobile") || l.includes("phone") || l.includes("android") || l.includes("iphone")) return Smartphone;
  if (l.includes("tablet") || l.includes("ipad")) return Tablet;
  return Monitor;
};

export const ActiveUsers = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setIsLoading(true);
    const { data: deviceData } = await supabase
      .from("user_devices")
      .select("*")
      .order("last_sign_in_at", { ascending: false });

    const deviceList = (deviceData ?? []) as UserDevice[];
    setDevices(deviceList);

    if (deviceList.length > 0) {
      const userIds = [...new Set(deviceList.map((d) => d.user_id))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);

      const profileMap: Record<string, UserProfile> = {};
      for (const p of (profileData ?? []) as UserProfile[]) {
        profileMap[p.user_id] = p;
      }
      setProfiles(profileMap);
    }

    setIsLoading(false);
  };

  const revokeDevice = async (deviceId: string) => {
    setRevoking(deviceId);
    const { error } = await supabase
      .from("user_devices")
      .update({ is_revoked: true })
      .eq("id", deviceId);
    if (error) {
      toast({ title: "Error", description: "Failed to revoke device.", variant: "destructive" });
    } else {
      toast({ title: "Device revoked" });
      fetchDevices();
    }
    setRevoking(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const activeDevices = devices.filter((d) => !d.is_revoked);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{activeDevices.length} active device(s)</h3>
          <p className="text-sm text-muted-foreground">{devices.length} total sign-in(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDevices}>Refresh</Button>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No device sign-ins recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const Icon = deviceIcon(d.device_label);
            return (
              <div key={d.id} className={`flex items-center gap-4 p-4 rounded-xl border ${d.is_revoked ? "bg-muted/50 border-border opacity-60" : "bg-card border-border"}`}>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{profiles[d.user_id]?.full_name || profiles[d.user_id]?.email || "Unknown user"}</span>
                    {d.is_revoked && <Badge variant="secondary" className="text-xs">Revoked</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.device_label}
                    {d.ip_address && ` · ${d.ip_address}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {new Date(d.last_sign_in_at).toLocaleString()} · {d.sign_in_count} sign-in(s)
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {!d.is_revoked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeDevice(d.id)}
                      disabled={revoking === d.id}
                      title="Revoke device"
                    >
                      {revoking === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveUsers;
