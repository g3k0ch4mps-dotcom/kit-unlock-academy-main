import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, RotateCcw, CheckCircle2, XCircle, Users, BookOpen, ChevronRight, ChevronDown, Zap } from "lucide-react";

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 50 },
  { level: 3, xp: 150 },
  { level: 4, xp: 300 },
  { level: 5, xp: 500 },
  { level: 6, xp: 800 },
  { level: 7, xp: 1200 },
  { level: 8, xp: 1700 },
  { level: 9, xp: 2300 },
  { level: 10, xp: 3000 },
];

function calculateLevel(totalXp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (totalXp >= t.xp) level = t.level;
  }
  return level;
}

interface Profile {
  user_id: string;
  email: string;
  full_name: string | null;
}

interface Program {
  id: string;
  title: string;
}

interface SessionInfo {
  id: string;
  title: string;
  session_order: number;
  program_id: string;
}

interface SessionProgress {
  session_id: string;
  completed: boolean;
  completed_at: string | null;
  progress_percentage: number | null;
}

interface SessionScore {
  session_id: string;
  score: number;
}

export const UserSessionManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, SessionProgress>>({});
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resettingXp, setResettingXp] = useState<string | null>(null);
  const [xpAwardedMap, setXpAwardedMap] = useState<Record<string, boolean>>({});
  const [expandedPrograms, setExpandedPrograms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchUsers();
    fetchPrograms();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, email, full_name")
      .order("email");

    setUsers((data ?? []) as Profile[]);
    setIsLoading(false);
  };

  const fetchPrograms = async () => {
    const { data } = await supabase
      .from("programs")
      .select("id, title")
      .order("title");

    setPrograms(data ?? []);
  };

  const fetchUserProgress = async (userId: string, programId: string) => {
    setIsProgressLoading(true);

    // Get all sessions for this program
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("id, title, session_order, program_id")
      .eq("program_id", programId)
      .order("session_order");

    setSessions((sessionData ?? []) as SessionInfo[]);

    if (sessionData && sessionData.length > 0) {
      const sessionIds = sessionData.map(s => s.id);

      // Get progress
      const { data: progressData } = await supabase
        .from("session_progress")
        .select("*")
        .eq("user_id", userId)
        .in("session_id", sessionIds);

      const pMap: Record<string, SessionProgress> = {};
      for (const p of (progressData ?? []) as SessionProgress[]) {
        pMap[p.session_id] = p;
      }
      setProgressMap(pMap);

      // Get best quiz scores
      const { data: quizData } = await supabase
        .from("session_quiz_attempts")
        .select("session_id, score")
        .eq("user_id", userId)
        .in("session_id", sessionIds)
        .order("score", { ascending: false });

      const bestScores: Record<string, number> = {};
      for (const q of (quizData ?? []) as SessionScore[]) {
        if (!bestScores[q.session_id] || q.score > bestScores[q.session_id]) {
          bestScores[q.session_id] = q.score;
        }
      }
      setScoreMap(bestScores);

      // Check which sessions have XP awarded
      const { data: xpTx } = await supabase
        .from("xp_transactions")
        .select("reference_id")
        .eq("user_id", userId)
        .eq("reference_type", "session")
        .in("reference_id", sessionIds);

      const xpMap: Record<string, boolean> = {};
      for (const tx of (xpTx ?? [])) {
        xpMap[tx.reference_id] = true;
      }
      setXpAwardedMap(xpMap);
    } else {
      setSessions([]);
      setProgressMap({});
      setScoreMap({});
      setXpAwardedMap({});
    }

    setIsProgressLoading(false);
  };

  const resetSession = async (sessionId: string, sessionTitle: string) => {
    if (!selectedUser) return;
    setResetting(sessionId);

    const { error } = await supabase
      .from("session_progress")
      .update({
        completed: false,
        completed_at: null,
        progress_percentage: 0,
      })
      .eq("user_id", selectedUser.user_id)
      .eq("session_id", sessionId);

    if (error) {
      toast({ title: "Error", description: "Failed to reset session.", variant: "destructive" });
    } else {
      toast({ title: "Session Reset", description: `"${sessionTitle}" has been reset to incomplete.` });
      if (selectedProgram) fetchUserProgress(selectedUser.user_id, selectedProgram);
    }

    setResetting(null);
  };

  const resetSessionXp = async (sessionId: string, sessionTitle: string) => {
    if (!selectedUser) return;
    setResettingXp(sessionId);

    // Delete XP transactions for this session
    const { error: delError } = await supabase
      .from("xp_transactions")
      .delete()
      .eq("user_id", selectedUser.user_id)
      .eq("reference_type", "session")
      .eq("reference_id", sessionId);

    if (delError) {
      toast({ title: "Error", description: "Failed to reset XP.", variant: "destructive" });
      setResettingXp(null);
      return;
    }

    // Also delete quiz XP transactions for this session
    await supabase
      .from("xp_transactions")
      .delete()
      .eq("user_id", selectedUser.user_id)
      .eq("reference_type", "session_quiz")
      .eq("reference_id", sessionId);

    // Recalculate total XP from remaining transactions
    const { data: remaining } = await supabase
      .from("xp_transactions")
      .select("amount")
      .eq("user_id", selectedUser.user_id);

    const newTotal = (remaining ?? []).reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    const { error: updateError } = await supabase
      .from("user_xp")
      .update({ total_xp: newTotal, level: calculateLevel(newTotal) })
      .eq("user_id", selectedUser.user_id);

    if (updateError) {
      toast({ title: "Error", description: "XP deleted but failed to update total.", variant: "destructive" });
    } else {
      toast({ title: "XP Reset", description: `Removed XP for "${sessionTitle}". Total: ${newTotal} XP.` });
      setXpAwardedMap(prev => ({ ...prev, [sessionId]: false }));
      if (selectedProgram) fetchUserProgress(selectedUser.user_id, selectedProgram);
    }

    setResettingXp(null);
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.full_name?.toLowerCase() || "").includes(q);
  });

  const userProgramAccess = async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from("user_program_access")
      .select("program_id")
      .eq("user_id", userId);

    return (data ?? []).map(d => d.program_id);
  };

  const handleSelectUser = async (user: Profile) => {
    setSelectedUser(user);
    setSelectedProgram("");

    // Auto-select a program they have access to
    const programIds = await userProgramAccess(user.user_id);
    if (programIds.length > 0) {
      const firstProgram = programs.find(p => programIds.includes(p.id));
      if (firstProgram) {
        setSelectedProgram(firstProgram.id);
        fetchUserProgress(user.user_id, firstProgram.id);
      }
    }
  };

  const handleProgramChange = (programId: string) => {
    setSelectedProgram(programId);
    if (selectedUser && programId) {
      fetchUserProgress(selectedUser.user_id, programId);
    }
  };

  const toggleExpand = async (user: Profile) => {
    if (expandedPrograms[user.user_id]) {
      setExpandedPrograms(prev => ({ ...prev, [user.user_id]: false }));
      if (selectedUser?.user_id === user.user_id) {
        setSelectedUser(null);
      }
      return;
    }
    setExpandedPrograms(prev => ({ ...prev, [user.user_id]: true }));
    await handleSelectUser(user);
  };

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => progressMap[s.id]?.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">User Session Management</h2>
          <p className="text-sm text-muted-foreground">View and reset learner session progress</p>
        </div>
      </div>

      {/* User Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">
              Users ({filteredUsers.length})
            </h3>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {search ? "No users match your search." : "No users found."}
              </div>
            ) : (
              filteredUsers.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => toggleExpand(u)}
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors ${
                    selectedUser?.user_id === u.user_id ? "bg-muted" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(u.full_name || u.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {expandedPrograms[u.user_id] ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Session Progress */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedUser ? (
                  <span>{selectedUser.full_name || selectedUser.email}</span>
                ) : (
                  "Session Progress"
                )}
              </h3>
              {selectedUser && (
                <Badge variant="secondary" className="text-xs">
                  {selectedProgram ? `${completedSessions}/${totalSessions} complete` : "Select a program"}
                </Badge>
              )}
            </div>
            {selectedUser && (
              <div className="mt-3">
                <Select value={selectedProgram} onValueChange={handleProgramChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {!selectedUser ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Select a user to view session progress</p>
              </div>
            ) : isProgressLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !selectedProgram ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Select a program to view sessions</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No sessions found for this program.</p>
              </div>
            ) : (
              sessions.map(s => {
                const progress = progressMap[s.id];
                const isCompleted = progress?.completed ?? false;
                const score = scoreMap[s.id];

                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-4 p-4 ${
                      isCompleted ? "bg-success/5" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? "bg-success/10" : "bg-muted"
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">S{s.session_order}</span>
                        <span className="font-medium text-sm truncate">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {isCompleted && progress?.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            Completed: {new Date(progress.completed_at).toLocaleDateString()}
                          </span>
                        )}
                        {score !== undefined && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              score >= 80
                                ? "border-success/30 text-success"
                                : score >= 50
                                ? "border-warning/30 text-warning"
                                : "border-destructive/30 text-destructive"
                            }`}
                          >
                            {score}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant={isCompleted ? "outline" : "ghost"}
                        size="sm"
                        className={isCompleted ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "text-muted-foreground"}
                        onClick={() => resetSession(s.id, s.title)}
                        disabled={resetting === s.id || !isCompleted}
                        title={isCompleted ? "Reset to incomplete" : "Already incomplete"}
                      >
                        {resetting === s.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span className="ml-1.5 text-xs">{isCompleted ? "Reset" : "—"}</span>
                      </Button>
                      {isCompleted && xpAwardedMap[s.id] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          onClick={() => resetSessionXp(s.id, s.title)}
                          disabled={resettingXp === s.id}
                          title="Remove XP awarded for this session"
                        >
                          {resettingXp === s.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          <span className="ml-1 text-xs">XP</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedUser && selectedProgram && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Program progress: {completedSessions}/{totalSessions} sessions completed
            </span>
            <Progress
              value={totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0}
              className="w-48 h-2"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSessionManager;
