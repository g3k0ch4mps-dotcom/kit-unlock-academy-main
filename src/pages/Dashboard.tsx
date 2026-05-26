import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Cpu, 
  BookOpen, 
  Lock, 
  Unlock,
  ArrowRight,
  Search,
  Key,
  Sparkles,
  Clock,
  Zap,
} from "lucide-react";
import { RedeemCodeModal } from "@/components/modals/RedeemCodeModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EnrolledProgram {
  id: string;
  program_id: string;
  unlocked_at: string;
  program: {
    id: string;
    title: string;
    description: string | null;
    kit: {
      id: string;
      name: string;
      image_url: string | null;
      category: string;
    };
  };
  totalSessions: number;
  completedSessions: number;
}

interface RecentActivity {
  id: string;
  type: "session" | "unlock";
  name: string;
  program: string;
  time: string;
  timestamp: Date;
}

const fetchEnrolledPrograms = async (userId: string): Promise<EnrolledProgram[]> => {
  const { data: accessData, error: accessError } = await supabase
    .from("user_program_access")
    .select(`
      id, program_id, unlocked_at,
      programs:program_id (
        id, title, description,
        kits:kit_id (id, name, image_url, category)
      )
    `)
    .eq("user_id", userId);

  if (accessError) throw accessError;
  if (!accessData || accessData.length === 0) return [];

  const programIds = accessData.map(a => a.program_id);

  const { data: allSessions } = await supabase
    .from("sessions")
    .select("id, program_id")
    .in("program_id", programIds);

  const sessionCountMap: Record<string, number> = {};
  const sessionIdToProgram: Record<string, string> = {};
  if (allSessions) {
    for (const s of allSessions) {
      sessionCountMap[s.program_id] = (sessionCountMap[s.program_id] || 0) + 1;
      sessionIdToProgram[s.id] = s.program_id;
    }
  }

  const sessionIds = allSessions?.map(s => s.id) || [];
  const { data: completedProgress } = await supabase
    .from("session_progress")
    .select("session_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .in("session_id", sessionIds);

  const completedCountMap: Record<string, number> = {};
  if (completedProgress) {
    for (const p of completedProgress) {
      const progId = sessionIdToProgram[p.session_id];
      if (progId) completedCountMap[progId] = (completedCountMap[progId] || 0) + 1;
    }
  }

  return accessData.map((access: { id: string; program_id: string; unlocked_at: string; programs: { id: string; title: string; description: string | null; kits: { id: string; name: string; image_url: string | null; category: string } } }) => {
    const program = access.programs;
    const kit = program?.kits;
    const progId = access.program_id;
    return {
      id: access.id,
      program_id: progId,
      unlocked_at: access.unlocked_at,
      program: {
        id: program?.id,
        title: program?.title,
        description: program?.description,
        kit: {
          id: kit?.id,
          name: kit?.name,
          image_url: kit?.image_url,
          category: kit?.category,
        },
      },
      totalSessions: sessionCountMap[progId] || 0,
      completedSessions: completedCountMap[progId] || 0,
    };
  });
};

export const Dashboard = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");


  const { data: enrolledPrograms = [], isLoading } = useQuery({
    queryKey: ["enrolled-programs", user?.id],
    queryFn: () => fetchEnrolledPrograms(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userXP } = useQuery({
    queryKey: ["user-xp", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_xp")
        .select("total_xp, level")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) {
        console.error("Dashboard fetchUserXP error:", error);
        toast({ title: "Failed to load XP", variant: "destructive" });
      }
      return data ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Refresh XP data when returning to this page
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["user-xp", user.id] });
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const activities: RecentActivity[] = [];

      const { data: progressData } = await supabase
        .from("session_progress")
        .select(`
          id, last_accessed_at, completed,
          sessions:session_id (title, programs:program_id (title))
        `)
        .eq("user_id", user.id)
        .order("last_accessed_at", { ascending: false })
        .limit(5);

      if (progressData) {
        for (const progress of progressData as { id: string; last_accessed_at: string; sessions: { title: string; programs: { title: string } } | null }[]) {
          activities.push({
            id: progress.id,
            type: "session",
            name: progress.sessions?.title || "Session",
            program: progress.sessions?.programs?.title || "Program",
            time: formatTimeAgo(new Date(progress.last_accessed_at)),
            timestamp: new Date(progress.last_accessed_at),
          });
        }
      }

      const { data: unlockData } = await supabase
        .from("user_program_access")
        .select(`id, unlocked_at, programs:program_id (title)`)
        .eq("user_id", user.id)
        .order("unlocked_at", { ascending: false })
        .limit(5);

      if (unlockData) {
        for (const unlock of unlockData as { id: string; unlocked_at: string; programs: { title: string } | null }[]) {
          activities.push({
            id: `unlock-${unlock.id}`,
            type: "unlock",
            name: "Program unlocked",
            program: unlock.programs?.title || "Program",
            time: formatTimeAgo(new Date(unlock.unlocked_at)),
            timestamp: new Date(unlock.unlocked_at),
          });
        }
      }

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return activities.slice(0, 5);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const handleCodeRedeemed = (programId: string, _programTitle: string) => {
    setIsRedeemModalOpen(false);
    if (user) {
      queryClient.invalidateQueries({ queryKey: ["enrolled-programs", user.id] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity", user.id] });
    }
  };

  const filteredPrograms = enrolledPrograms.filter(
    (p) =>
      p.program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.program.kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Learner";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
            <p className="text-muted-foreground">Continue your learning journey or redeem a new kit.</p>
          </div>
          <Button variant="hero" onClick={() => setIsRedeemModalOpen(true)}>
            <Key className="h-5 w-5 mr-2" />
            Redeem Unlock Code
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Cpu className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enrolledPrograms.length}</p>
                <p className="text-sm text-muted-foreground">My Programs</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/30 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {enrolledPrograms.reduce((acc, p) => acc + p.completedSessions, 0)}/
                  {enrolledPrograms.reduce((acc, p) => acc + p.totalSessions, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Sessions Done</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <Unlock className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enrolledPrograms.length}</p>
                <p className="text-sm text-muted-foreground">Unlocked</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {userXP !== null ? `${userXP.total_xp}` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {userXP !== null ? `Level ${userXP.level} XP` : "XP Points"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* My Programs */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">My Programs</h2>
              {enrolledPrograms.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search programs..." 
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : enrolledPrograms.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Programs Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Redeem an unlock code to access your first learning program.
                </p>
                <Button variant="hero" onClick={() => setIsRedeemModalOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Redeem Unlock Code
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPrograms.map((enrollment) => (
                  <div 
                    key={enrollment.id}
                    className="flex gap-6 p-4 rounded-xl bg-card border border-primary/20 transition-all hover:shadow-md"
                  >
                    <div className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {enrollment.program.kit.image_url ? (
                        <img 
                          src={enrollment.program.kit.image_url} 
                          alt={enrollment.program.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Cpu className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold mb-1">{enrollment.program.title}</h3>
                          <p className="text-sm text-muted-foreground">{enrollment.program.description}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                          <Unlock className="h-3 w-3" />
                          Unlocked
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {enrollment.completedSessions}/{enrollment.totalSessions}
                          </span>
                        </div>
                        <Progress 
                          value={enrollment.totalSessions > 0 
                            ? (enrollment.completedSessions / enrollment.totalSessions) * 100 
                            : 0
                          } 
                          className="h-2" 
                        />
                      </div>
                      
                      <Button variant="default" size="sm" asChild>
                        <Link to={`/programs/${enrollment.program_id}`}>
                          Continue Learning
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {enrolledPrograms.length > 0 && (
              <div className="mt-6 text-center">
                <Button variant="ghost" asChild>
                  <Link to="/programs">
                    Browse All Programs
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => setIsRedeemModalOpen(true)}>
                  <Key className="h-4 w-4 mr-3" />
                  Redeem Code
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/programs">
                    <BookOpen className="h-4 w-4 mr-3" />
                    Browse Programs
                  </Link>
                </Button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Recent Activity
              </h3>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet. Start learning to see your progress here.
                </p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{activity.name}</p>
                        <p className="text-xs text-muted-foreground">{activity.program} • {activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Need Help */}
            <div className="bg-gradient-primary rounded-xl p-6 text-primary-foreground">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm opacity-90 mb-4">
                Our support team can help you with any questions about your kit.
              </p>
              <Button variant="secondary" size="sm" className="w-full">
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      
      <RedeemCodeModal 
        isOpen={isRedeemModalOpen} 
        onClose={() => setIsRedeemModalOpen(false)}
        onCodeRedeemed={handleCodeRedeemed}
      />
    </div>
  );
};

export default Dashboard;
