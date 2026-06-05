import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/layout/Logo";
import { 
  ArrowLeft,
  Lock,
  Unlock,
  Play,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileText,
  Key,
  BookOpen,
  Loader2,
  ClipboardCheck,
  Award,
  Brain,
  Zap
} from "lucide-react";
import { RedeemCodeModal } from "@/components/modals/RedeemCodeModal";
import { AssessmentModal } from "@/components/assessment/AssessmentModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useXP } from "@/hooks/use-xp";

 interface ProgramData {
   id: string;
   title: string;
   description: string | null;
   image_url: string | null;
   total_sessions: number;
   difficulty_level: string | null;
   category: string | null;
 }
 
 interface SessionData {
    id: string;
    title: string;
    duration_minutes: number | null;
    session_order: number;
    is_free: boolean;
    xp_cost: number | null;
  }
 
interface SessionProgress {
  session_id: string;
  completed: boolean;
}

interface SessionQuizScore {
  session_id: string;
  score: number;
}

interface ProgramTest {
  id: string;
  title: string;
  passing_score: number;
}

const getSessionIcon = (type: string) => {
  switch (type) {
    case "video":
      return Play;
    case "code":
      return Code2;
    case "tutorial":
      return FileText;
    case "project":
      return Cpu;
    default:
      return BookOpen;
  }
};

export const ProgramView = () => {
  const { id } = useParams();
   const { user } = useAuth();
  const { toast } = useToast();
  const { getUserXP, spendXP } = useXP();
  const [userXP, setUserXP] = useState<number>(0);
  const [unlockingSession, setUnlockingSession] = useState<string | null>(null);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [userSkillLevel, setUserSkillLevel] = useState<string | null>(null);
   const [program, setProgram] = useState<ProgramData | null>(null);
   const [sessions, setSessions] = useState<SessionData[]>([]);
  const [progressData, setProgressData] = useState<SessionProgress[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  // Per-session access grants (from codes): session_id -> expires_at | null (null = permanent)
  const [sessionAccess, setSessionAccess] = useState<Record<string, string | null>>({});
  // Whole-program grant expiry (null = permanent / none)
  const [programAccessExpiresAt, setProgramAccessExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [programTest, setProgramTest] = useState<ProgramTest | null>(null);
   const [hasPassed, setHasPassed] = useState(false);
   const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
   const [sessionScores, setSessionScores] = useState<SessionQuizScore[]>([]);
   const [hasCertificate, setHasCertificate] = useState(false);
   const [isGeneratingCert, setIsGeneratingCert] = useState(false);
 
  useEffect(() => {
    if (!id) return;

    const fetchAll = async () => {
      setIsLoading(true);

      const [programResult, sessionsResult, programTestResult] = await Promise.all([
        supabase.from("programs").select("*").eq("id", id).maybeSingle(),
        supabase.from("sessions").select("*").eq("program_id", id).order("session_order"),
        supabase.from("program_tests").select("id, title, passing_score").eq("program_id", id).maybeSingle(),
      ]);

      if (programResult.data) setProgram(programResult.data);
      if (sessionsResult.data) setSessions(sessionsResult.data);
      if (programTestResult.data) setProgramTest(programTestResult.data);

      if (user) {
        const [accessResult, sessionAccessResult, progressResult, passedResult, assessmentResult, scoresResult, certResult, xpData] = await Promise.all([
          supabase.from("user_program_access").select("id, expires_at").eq("program_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("user_session_access").select("session_id, expires_at").eq("user_id", user.id),
          supabase.from("session_progress").select("session_id, completed").eq("user_id", user.id),
          supabase.from("test_attempts").select("passed, program_tests!inner(program_id)").eq("user_id", user.id).eq("passed", true).eq("program_tests.program_id", id).limit(1),
          supabase.from("user_assessments").select("skill_level").eq("user_id", user.id).eq("program_id", id).maybeSingle(),
          supabase.from("session_quiz_attempts").select("session_id, score").eq("user_id", user.id).eq("program_id", id).order("score", { ascending: false }),
          supabase.from("certificates").select("id").eq("user_id", user.id).eq("program_id", id).limit(1),
          getUserXP(user.id),
        ]);

        // Whole-program grant is active if there's no expiry or it's in the future
        const nowMs = Date.now();
        const progExpiry = accessResult.data?.expires_at ?? null;
        const programActive = !!accessResult.data && (!progExpiry || new Date(progExpiry).getTime() > nowMs);
        setHasAccess(programActive);
        setProgramAccessExpiresAt(programActive ? progExpiry : null);

        // Active per-session grants only (drop expired ones)
        const accessMap: Record<string, string | null> = {};
        for (const row of sessionAccessResult.data ?? []) {
          if (!row.expires_at || new Date(row.expires_at).getTime() > nowMs) {
            accessMap[row.session_id] = row.expires_at;
          }
        }
        setSessionAccess(accessMap);

        if (progressResult.data) setProgressData(progressResult.data);
        setHasPassed(!!(passedResult.data && passedResult.data.length > 0));
        setHasCertificate(!!(certResult.data && certResult.data.length > 0));

        if (assessmentResult.data) {
          setHasAssessment(true);
          setUserSkillLevel(assessmentResult.data.skill_level);
        }

        if (scoresResult.data) {
          const bestScores: Record<string, number> = {};
          for (const d of scoresResult.data as { session_id: string; score: number }[]) {
            if (!bestScores[d.session_id] || d.score > bestScores[d.session_id]) {
              bestScores[d.session_id] = d.score;
            }
          }
          setSessionScores(Object.entries(bestScores).map(([session_id, score]) => ({ session_id, score })));
        }

        setUserXP(xpData?.spendable_xp ?? 0);
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [id, user]);

  const averageScore = useMemo(() =>
    sessionScores.length > 0
      ? Math.round(sessionScores.reduce((sum, s) => sum + s.score, 0) / sessionScores.length)
      : 0,
    [sessionScores]
  );

  const completedCount = useMemo(() =>
    progressData.filter(p => p.completed && sessions.some(s => s.id === p.session_id)).length,
    [progressData, sessions]
  );

  const progress = useMemo(() =>
    sessions.length > 0 ? (completedCount / sessions.length) * 100 : 0,
    [completedCount, sessions.length]
  );

  const allSessionsCompleted = useMemo(() =>
    sessions.length > 0 && completedCount === sessions.length,
    [sessions.length, completedCount]
  );

  const canGetCertificate = useMemo(() =>
    allSessionsCompleted && sessionScores.length === sessions.length && !hasCertificate,
    [allSessionsCompleted, sessionScores.length, sessions.length, hasCertificate]
  );

  const generateCertificate = async () => {
    if (!user || !id || !program) return;
    setIsGeneratingCert(true);
    try {
      const { error } = await supabase.functions.invoke("generate-certificate", {
        body: {
          userId: user.id,
          programId: id,
        },
      });
      if (!error) {
        setHasCertificate(true);
        toast({
          title: "Certificate Generated!",
          description: `Your certificate is now available in your profile.`,
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate certificate.", variant: "destructive" });
    } finally {
      setIsGeneratingCert(false);
    }
  };

  const checkAssessment = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from("user_assessments")
      .select("skill_level")
      .eq("user_id", user.id)
      .eq("program_id", id)
      .maybeSingle();
    
    if (data) {
      setHasAssessment(true);
      setUserSkillLevel(data.skill_level);
    }
  };

  const handleSessionClick = async (sessionId: string, isFree?: boolean) => {
    if (!user || !program) return;

    if (!hasAssessment && !isFree) {
      setPendingSessionId(sessionId);
      setIsAssessmentOpen(true);
      return;
    }

    const session = sessions.find(s => s.id === sessionId);
    const xpCost = session?.xp_cost ?? 0;
    const alreadyHasProgress = progressData.some(p => p.session_id === sessionId);

    // Spend XP to unlock a paid session the first time it's opened
    if (xpCost > 0 && !alreadyHasProgress) {
      // Gate: previous session must be completed first (complete AND pay)
      const idx = sessions.findIndex(s => s.id === sessionId);
      const prev = idx > 0 ? sessions[idx - 1] : null;
      const prevCompleted = prev
        ? progressData.some(p => p.session_id === prev.id && p.completed)
        : true;
      if (!session?.is_free && !prevCompleted) {
        toast({ title: "Locked", description: "Complete the previous session first.", variant: "destructive" });
        return;
      }

      if (userXP < xpCost) {
        toast({ title: "Not enough XP", description: `You need ${xpCost} XP to access this session.`, variant: "destructive" });
        return;
      }

      setUnlockingSession(sessionId);
      // Atomic, balance-checked spend against the spendable wallet (server-side)
      const result = await spendXP(user.id, xpCost, `Unlocked session: ${session?.title}`, "session", sessionId);

      if (result.error) {
        setUnlockingSession(null);
        toast({
          title: "Could not unlock",
          description: result.error === "Insufficient XP" ? "Not enough XP" : result.error,
          variant: "destructive",
        });
        return;
      }

      await supabase.from("session_progress").upsert({
        user_id: user.id,
        session_id: sessionId,
        completed: false,
        progress_percentage: 0,
      }, { onConflict: "user_id,session_id" });

      setUserXP(result.data?.spendable_xp ?? (userXP - xpCost));
      setUnlockingSession(null);

      toast({ title: `-${xpCost} XP`, description: `Unlocked "${session?.title}"` });
    }

    window.location.href = `/programs/${program.id}/session/${sessionId}`;
  };

  const handleAssessmentComplete = (level: string) => {
    setHasAssessment(true);
    setUserSkillLevel(level);
    setIsAssessmentOpen(false);
    if (pendingSessionId && program) {
      window.location.href = `/programs/${program.id}/session/${pendingSessionId}`;
    }
  };
 
  // These are computed values (moved up for use in canGetCertificate)
  // Original position kept for backward compat - see above
 
   if (isLoading) {
     return (
       <div className="min-h-screen bg-background">
         <Header />
         <div className="flex items-center justify-center py-24">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
         <Footer />
       </div>
     );
   }
 
   if (!program) {
     return (
       <div className="min-h-screen bg-background">
         <Header />
         <div className="container py-12 text-center">
           <h1 className="text-2xl font-bold mb-4">Program Not Found</h1>
           <Button asChild>
             <Link to="/programs">Back to Programs</Link>
           </Button>
         </div>
         <Footer />
       </div>
     );
   }


  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Back Navigation */}
        <Link 
          to="/dashboard" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Program Header */}
        <div className="bg-card rounded-2xl overflow-hidden border border-border mb-8">
          <div className="relative h-48 md:h-64">
             {program.image_url ? (
               <img 
                 src={program.image_url} 
                 alt={program.title}
                 className="w-full h-full object-cover"
               />
             ) : (
               <div className="w-full h-full bg-muted flex items-center justify-center">
                 <Cpu className="h-16 w-16 text-muted-foreground" />
               </div>
             )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-2">
                 {hasAccess ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                    <Unlock className="h-3 w-3" />
                    Full Access
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-background bg-background/20 px-2 py-1 rounded-full">
                    <Lock className="h-3 w-3" />
                    Preview Mode
                  </span>
                )}
                {userSkillLevel && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/20 px-2 py-1 rounded-full capitalize">
                    <Brain className="h-3 w-3" />
                    {userSkillLevel} Level
                  </span>
                )}
              </div>
               <h1 className="text-2xl md:text-3xl font-bold text-background">{program.title}</h1>
            </div>
          </div>
          
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <div className="flex-1">
                <p className="text-muted-foreground mb-4">{program.description}</p>
                
                  {hasAccess && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Your Progress</span>
                         <span className="font-semibold">{completedCount}/{sessions.length} sessions</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold text-yellow-600">{userXP} XP</span>
                    <span className="text-muted-foreground">available</span>
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-6">Sessions</h2>
            
            <div className="space-y-3">
                {sessions.map((session, index) => {
                  const SessionIcon = getSessionIcon("tutorial");
                  const hasProgress = progressData.some(p => p.session_id === session.id);
                  const isCompleted = progressData.some(p => p.session_id === session.id && p.completed);
                  // Accessible via: free, an active whole-program grant, or an active per-session grant
                  const hasSessionGrant = Object.prototype.hasOwnProperty.call(sessionAccess, session.id);
                  const isLocked = !session.is_free && !hasAccess && !hasSessionGrant;
                  // Access expiry shown to the learner: session grant first, else the program grant
                  const grantExpiry = hasSessionGrant ? sessionAccess[session.id] : (hasAccess ? programAccessExpiresAt : null);
                  const daysLeft = grantExpiry
                    ? Math.max(0, Math.ceil((new Date(grantExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : null;
                  const xpCost = session.xp_cost ?? 0;
                  const alreadyUnlocked = hasProgress;
                  const prevSession = index > 0 ? sessions[index - 1] : null;
                  const isPrevCompleted = prevSession
                    ? progressData.some(p => p.session_id === prevSession.id && p.completed)
                    : true;
                  // Blocked by previous session not completed
                  const needsPrevGate = !alreadyUnlocked && !isPrevCompleted && !session.is_free && index > 0;
                  // Needs XP unlock if: not locked by program access, has xp_cost, and not already started
                  const needsXp = !isLocked && xpCost > 0 && !alreadyUnlocked;
                  // Can afford XP unlock
                  const canAfford = needsXp && userXP >= xpCost;
                  const quizScore = sessionScores.find(s => s.session_id === session.id);
                  
                return (
                  <div 
                    key={session.id}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                       isCompleted 
                         ? "bg-success/5 border-success/20 session-unlocked" 
                         : isLocked
                           ? "bg-muted/50 border-border session-locked"
                           : needsXp
                             ? "bg-card border-yellow-200 hover:border-yellow-400"
                             : session.is_free
                              ? "bg-accent/20 border-accent/30 session-free hover:border-accent"
                              : "bg-card border-border session-unlocked hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                       isCompleted 
                        ? "bg-success/10" 
                        : isLocked 
                          ? "bg-muted" 
                          : "bg-primary/10"
                    }`}>
                      {isCompleted ? (
                         <CheckCircle2 className="h-5 w-5 text-success" />
                       ) : isLocked ? (
                         <Lock className="h-5 w-5 text-muted-foreground" />
                       ) : (
                         <SessionIcon className={`h-5 w-5 ${session.is_free ? "text-accent-foreground" : "text-primary"}`} />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="text-xs text-muted-foreground">Session {session.session_order}</span>
                         {session.is_free && (
                          <span className="text-xs font-medium text-accent-foreground bg-accent/50 px-2 py-0.5 rounded-full">
                            Free Preview
                          </span>
                        )}
                        {daysLeft !== null && !isLocked && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            daysLeft <= 1 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                          }`}>
                            <Clock className="h-3 w-3" />
                            {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                      <h3 className={`font-medium ${isLocked ? "text-muted-foreground" : ""}`}>
                        {session.title}
                      </h3>
                      {!isLocked && xpCost > 0 && (
                        <p className={`text-xs mt-0.5 ${canAfford ? "text-yellow-600" : "text-destructive"}`}>
                          Cost: {xpCost} XP · You have: {userXP} XP
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {quizScore && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          quizScore.score >= 80 ? "bg-success/10 text-success" : 
                          quizScore.score >= 50 ? "bg-warning/10 text-warning" : 
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {quizScore.score}%
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                         {session.duration_minutes || 30} min
                      </span>
                      
                      {needsPrevGate ? (
                        <span className="text-xs text-muted-foreground text-center max-w-[100px] leading-tight">
                          Complete previous session first
                        </span>
                      ) : needsXp ? (
                        <Button
                          variant={canAfford ? "default" : "outline"}
                          size="sm"
                          className={canAfford ? "bg-yellow-600 hover:bg-yellow-700 gap-1" : "text-muted-foreground gap-1"}
                          onClick={() => handleSessionClick(session.id, session.is_free)}
                          disabled={!canAfford || unlockingSession === session.id}
                        >
                          {unlockingSession === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          {canAfford ? `Start (${xpCost} XP)` : `Need ${xpCost} XP`}
                        </Button>
                      ) : !isLocked && (
                        <Button 
                           variant={isCompleted ? "ghost" : "default"} 
                          size="sm"
                          onClick={() => handleSessionClick(session.id, session.is_free)}
                        >
                           {isCompleted ? "Review" : "Start"}
                        </Button>
                      )}
                    </div>
                    
                    {/* Watermark for content protection */}
                    <div className="absolute bottom-2 right-4 opacity-5">
                      <Logo size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Average Score & Certificate Section */}
            {hasAccess && sessionScores.length > 0 && (
              <div className="mt-8 p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Program Score
                  </h3>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${averageScore >= 80 ? "text-success" : averageScore >= 50 ? "text-warning" : "text-destructive"}`}>
                      {averageScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">Average of {sessionScores.length} session quizzes</p>
                  </div>
                </div>
                <Progress value={averageScore} className="h-3 mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  {averageScore >= 80
                    ? "You qualify for a Certificate of Completion!"
                    : `Score 80%+ average across all sessions for a Certificate of Completion. Below 80% earns a Certificate of Participation.`}
                </p>
              </div>
            )}

            {/* Generate Certificate */}
            {hasAccess && canGetCertificate && (
              <div className="mt-4 p-6 rounded-xl bg-gradient-primary text-primary-foreground">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-background/20 flex items-center justify-center">
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {averageScore >= 80 ? "Earn Your Completion Certificate!" : "Get Your Participation Certificate"}
                    </h3>
                    <p className="text-sm opacity-90">
                      All sessions completed with an average score of {averageScore}%.
                    </p>
                  </div>
                  <Button variant="secondary" size="lg" onClick={generateCertificate} disabled={isGeneratingCert}>
                    {isGeneratingCert ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Award className="h-4 w-4 mr-2" />}
                    Get Certificate
                  </Button>
                </div>
              </div>
            )}

            {/* Certificate Earned Section */}
            {hasCertificate && (
              <div className="mt-4 p-6 rounded-xl bg-success/10 border border-success/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <Award className="h-6 w-6 text-success" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-success">Certificate Earned!</h3>
                    <p className="text-sm text-muted-foreground">
                      View and download your certificate from your profile.
                    </p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link to="/profile">View Certificate</Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Take Final Test (legacy) */}
            {hasAccess && allSessionsCompleted && programTest && !hasPassed && (
              <div className="mt-4 p-4 rounded-xl bg-muted border border-border">
                <div className="flex items-center gap-4">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Optional: Take the Final Test</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/test/${programTest.id}`}>Take Test</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
             {!hasAccess && (
              <div className="bg-gradient-primary rounded-xl p-6 text-primary-foreground">
                <Lock className="h-8 w-8 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Unlock Full Access</h3>
                <p className="text-sm opacity-90 mb-4">
                   Enter your unlock code to access all {sessions.length} sessions and complete the program.
                </p>
                <Button 
                  variant="secondary" 
                  className="w-full"
                  onClick={() => setIsRedeemModalOpen(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Redeem Code
                </Button>
              </div>
            )}

            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-semibold mb-4">What You'll Learn</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>ESP32 microcontroller programming</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Sensor integration and data reading</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>WiFi connectivity and cloud integration</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Building and deploying IoT projects</span>
                </li>
              </ul>
            </div>

            <div className="bg-muted rounded-xl p-6">
              <h3 className="font-semibold mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Stuck on a step? Our AI assistant knows your exact kit.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.dispatchEvent(new Event("open-ai-chat"))}
              >
                Ask AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      
      <RedeemCodeModal 
        isOpen={isRedeemModalOpen} 
        onClose={() => setIsRedeemModalOpen(false)}
        onCodeRedeemed={(_programId, _programTitle) => {
          // Refresh access + sessions so newly unlocked content appears
          setIsRedeemModalOpen(false);
          window.location.reload();
        }}
      />
      
      {program && (
        <AssessmentModal
          isOpen={isAssessmentOpen}
          onClose={() => setIsAssessmentOpen(false)}
          programId={program.id}
          programTitle={program.title}
          programCategory={program.category}
          onComplete={handleAssessmentComplete}
        />
      )}
    </div>
  );
};

export default ProgramView;
