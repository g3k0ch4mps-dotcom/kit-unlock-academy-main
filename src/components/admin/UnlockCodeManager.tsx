import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Loader2,
  RefreshCw,
  Calendar,
  AlertTriangle,
  Clock
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Program {
  id: string;
  title: string;
  kit_id: string;
}

interface SessionLite {
  id: string;
  title: string;
  session_order: number;
}

interface UnlockCode {
  id: string;
  code: string;
  program_id: string;
  xp_reward: number | null;
  is_used: boolean;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  created_at: string;
  scope: string;
  access_days: number | null;
  max_uses: number | null;
  uses_count: number;
  program?: {
    title: string;
  };
}

type UseType = "single" | "multi" | "unlimited";

export const UnlockCodeManager = () => {
  const [codes, setCodes] = useState<UnlockCode[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [xpReward, setXpReward] = useState<number | null>(null);
  // v2 fields
  const [scope, setScope] = useState<"program" | "sessions">("program");
  const [programSessions, setProgramSessions] = useState<SessionLite[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [accessDays, setAccessDays] = useState<number | null>(null);
  const [useType, setUseType] = useState<UseType>("single");
  const [maxUses, setMaxUses] = useState<number>(30);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [codesRes, programsRes] = await Promise.all([
      supabase
        .from("unlock_codes")
        .select(`*, program:programs(title)`)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("programs")
        .select("id, title, kit_id")
        .order("title")
    ]);

    if (codesRes.data) setCodes(codesRes.data as unknown as UnlockCode[]);
    if (programsRes.data) setPrograms(programsRes.data as Program[]);
    
    setIsLoading(false);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "MAMUZA-";
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      if (i < 3) code += "-";
    }
    return code;
  };

  const handleProgramChange = async (programId: string) => {
    setSelectedProgram(programId);
    setSelectedSessions([]);
    const { data } = await supabase
      .from("sessions")
      .select("id, title, session_order")
      .eq("program_id", programId)
      .order("session_order");
    setProgramSessions((data as SessionLite[]) ?? []);
  };

  const toggleSession = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((s) => s !== sessionId) : [...prev, sessionId]
    );
  };

  const resetForm = () => {
    setSelectedProgram("");
    setProgramSessions([]);
    setSelectedSessions([]);
    setQuantity(1);
    setExpiresInDays(null);
    setXpReward(null);
    setScope("program");
    setAccessDays(null);
    setUseType("single");
    setMaxUses(30);
  };

  const handleGenerate = async () => {
    if (!selectedProgram || !user) return;
    if (scope === "sessions" && selectedSessions.length === 0) {
      toast({ title: "Select modules", description: "Pick at least one module to unlock.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const computedMaxUses = useType === "single" ? 1 : useType === "unlimited" ? null : Math.max(1, maxUses);

    const newCodes = Array.from({ length: quantity }).map(() => ({
      code: generateCode(),
      program_id: selectedProgram,
      xp_reward: xpReward,
      expires_at: expiresAt,
      created_by: user.id,
      scope,
      access_days: accessDays,
      max_uses: computedMaxUses,
    }));

    const { data: inserted, error } = await supabase
      .from("unlock_codes")
      .insert(newCodes)
      .select("id");

    if (error || !inserted) {
      console.error("Failed to generate codes:", error);
      toast({
        title: "Failed to generate codes",
        description: error?.message ?? "Unknown error. Check the console for details.",
        variant: "destructive",
      });
      setIsGenerating(false);
      return;
    }

    // For module-scoped codes, link each new code to the chosen sessions
    if (scope === "sessions") {
      const links = inserted.flatMap((c) =>
        selectedSessions.map((sid) => ({ unlock_code_id: c.id, session_id: sid }))
      );
      const { error: linkErr } = await supabase.from("unlock_code_sessions").insert(links);
      if (linkErr) {
        console.error("Failed to link code sessions:", linkErr);
        toast({
          title: "Partial error",
          description: linkErr.message ?? "Codes were created but module links failed.",
          variant: "destructive",
        });
      }
    }

    toast({ title: "Codes Generated", description: `Successfully generated ${quantity} unlock code(s).` });
    fetchData();
    setIsDialogOpen(false);
    resetForm();
    setIsGenerating(false);
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Copied",
      description: "Code copied to clipboard.",
    });
  };

  const handleRevoke = async (codeId: string) => {
    const { error } = await supabase
      .from("unlock_codes")
      .delete()
      .eq("id", codeId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to revoke code.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Code Revoked",
        description: "The unlock code has been deleted.",
      });
      fetchData();
    }
  };

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = codes.filter(c => 
    !c.is_used && c.expires_at && 
    new Date(c.expires_at) > now && 
    new Date(c.expires_at) <= sevenDaysFromNow
  );

  return (
    <div className="space-y-6">
      {/* Expiration Alert Banner */}
      {expiringSoon.length > 0 && (
        <Alert variant="destructive" className="border-warning/50 bg-warning/5 text-warning">
          <Clock className="h-4 w-4" />
          <AlertTitle className="text-foreground">
            {expiringSoon.length} code{expiringSoon.length > 1 ? "s" : ""} expiring within 7 days
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            <div className="mt-2 space-y-1">
              {expiringSoon.slice(0, 5).map(c => {
                const daysLeft = Math.ceil((new Date(c.expires_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{c.code}</code>
                    <span className="flex items-center gap-2">
                      <span>{c.program?.title}</span>
                      <Badge variant="outline" className="text-warning border-warning/30">
                        {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-destructive"
                        onClick={() => handleRevoke(c.id)}
                      >
                        Revoke
                      </Button>
                    </span>
                  </div>
                );
              })}
              {expiringSoon.length > 5 && (
                <p className="text-xs">...and {expiringSoon.length - 5} more</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Unlock Code Management</h2>
            <p className="text-sm text-muted-foreground">
              Generate and manage single-use access codes
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="hero" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Codes
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold">{codes.length}</p>
          <p className="text-sm text-muted-foreground">Total Codes</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold text-green-600">
            {codes.filter(c => !c.is_used).length}
          </p>
          <p className="text-sm text-muted-foreground">Available</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold text-primary">
            {codes.filter(c => c.is_used).length}
          </p>
          <p className="text-sm text-muted-foreground">Redeemed</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold text-destructive">
            {codes.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length}
          </p>
          <p className="text-sm text-muted-foreground">Expired</p>
        </div>
      </div>

      {/* Codes Table */}
      <div className="rounded-xl bg-card border border-border">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center p-12">
            <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No unlock codes generated yet.</p>
            <Button 
              variant="hero" 
              className="mt-4"
              onClick={() => setIsDialogOpen(true)}
            >
              Generate Your First Code
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => {
                const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                const usesLabel = code.max_uses === null
                  ? `${code.uses_count} / ∞`
                  : `${code.uses_count} / ${code.max_uses}`;
                const exhausted = code.max_uses !== null && code.uses_count >= code.max_uses;
                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <code className="px-2 py-1 rounded bg-muted text-sm font-mono">
                        {code.code}
                      </code>
                    </TableCell>
                    <TableCell>{code.program?.title || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {code.scope === "sessions" ? "Modules" : "Program"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.access_days ? `${code.access_days}d` : "Permanent"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{usesLabel}</TableCell>
                    <TableCell>
                      {exhausted ? (
                        <Badge variant="secondary">Used up</Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.expires_at
                        ? new Date(code.expires_at).toLocaleDateString()
                        : "—"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(code.code)}
                          disabled={code.is_used}
                          aria-label="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleRevoke(code.id)}
                          aria-label="Revoke code"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Generate Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Unlock Codes</DialogTitle>
            <DialogDescription>
              Create scoped, time-boxed access codes for your students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={selectedProgram} onValueChange={handleProgramChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program..." />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scope */}
            <div className="space-y-2">
              <Label>What does this code unlock?</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={scope === "program" ? "default" : "outline"} size="sm" onClick={() => setScope("program")}>
                  Whole program
                </Button>
                <Button type="button" variant={scope === "sessions" ? "default" : "outline"} size="sm" onClick={() => setScope("sessions")}>
                  Specific modules
                </Button>
              </div>
            </div>

            {/* Module checklist */}
            {scope === "sessions" && (
              <div className="space-y-2">
                <Label>Modules to unlock</Label>
                {!selectedProgram ? (
                  <p className="text-xs text-muted-foreground">Select a program first.</p>
                ) : programSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This program has no sessions yet.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {programSessions.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={selectedSessions.includes(s.id)} onCheckedChange={() => toggleSession(s.id)} />
                        <span>{s.session_order}. {s.title}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{selectedSessions.length} module(s) selected.</p>
              </div>
            )}

            {/* Access duration (rolling per-student) */}
            <div className="space-y-2">
              <Label>Access duration (days)</Label>
              <Input
                type="number"
                value={accessDays ?? ""}
                onChange={(e) => setAccessDays(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Permanent"
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                Days of access each student gets <em>after they redeem</em>. Empty = never expires.
              </p>
            </div>

            {/* Uses */}
            <div className="space-y-2">
              <Label>How many people can use each code?</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={useType === "single" ? "default" : "outline"} size="sm" onClick={() => setUseType("single")}>
                  Single-use
                </Button>
                <Button type="button" variant={useType === "multi" ? "default" : "outline"} size="sm" onClick={() => setUseType("multi")}>
                  Multi-use
                </Button>
                <Button type="button" variant={useType === "unlimited" ? "default" : "outline"} size="sm" onClick={() => setUseType("unlimited")}>
                  Unlimited
                </Button>
              </div>
              {useType === "multi" && (
                <Input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(parseInt(e.target.value) || 2)}
                  min={2}
                  placeholder="Max redemptions"
                />
              )}
              <p className="text-xs text-muted-foreground">
                {useType === "single"
                  ? "One student per code — generate a batch for a class."
                  : useType === "multi"
                    ? `Up to ${maxUses} different students can redeem the same code.`
                    : "Anyone with the code can redeem it — no limit."}
              </p>
            </div>

            {/* Redemption deadline (hard stop on the code itself) */}
            <div className="space-y-2">
              <Label>Redemption deadline (days)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={expiresInDays || ""}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No deadline"
                  min={1}
                />
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                How long the code stays redeemable. Different from access duration above.
              </p>
            </div>

            {/* XP reward */}
            <div className="space-y-2">
              <Label>XP Reward (optional)</Label>
              <Input
                type="number"
                value={xpReward ?? ""}
                onChange={(e) => setXpReward(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="No XP reward"
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                If set, redeeming also awards this much XP.
              </p>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min={1}
                max={500}
              />
              <p className="text-xs text-muted-foreground">
                For single-use, generate one per student. For multi-use/unlimited, usually 1 shared code.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={handleGenerate}
              disabled={!selectedProgram || isGenerating || (scope === "sessions" && selectedSessions.length === 0)}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate {quantity} Code{quantity > 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnlockCodeManager;
