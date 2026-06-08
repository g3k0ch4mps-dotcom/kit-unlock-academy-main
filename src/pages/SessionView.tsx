import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  Loader2,
  Brain,
  RefreshCw,
  BookOpen,
  RotateCcw,
  Clock,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useXP } from "@/hooks/use-xp";
import { useStreak } from "@/hooks/use-streak";
import { ContentBlockRenderer } from "@/components/content/ContentBlockRenderer";
import { SimulationEmbed } from "@/components/content/SimulationEmbed";
import { SessionQuiz } from "@/components/quiz/SessionQuiz";
import { ContentBlockAttachments } from "@/components/learning/ContentBlockAttachments";

// ── Chapter definitions ────────────────────────────────────────────────────────
type ChapterId = "introduction" | "components" | "wiring" | "code";

const CHAPTER_DEFS: { id: ChapterId; label: string; types: string[] }[] = [
  { id: "introduction", label: "Introduction", types: ["text", "problem", "tip"] },
  { id: "components",   label: "Components",   types: ["components", "image"] },
  { id: "wiring",       label: "Wiring",       types: ["circuit_diagram", "diagram", "safety_note"] },
  { id: "code",         label: "Code",         types: ["code", "solution", "questions", "feedback"] },
];

interface SessionData {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  session_order: number;
  program_id: string;
  simulation_url: string | null;
  is_free: boolean;
}

interface ContentBlock {
  id: string;
  block_type: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  code_language: string | null;
  block_order: number;
}

interface Program {
  id: string;
  title: string;
}

interface ActiveChapter {
  id: ChapterId;
  label: string;
  blocks: ContentBlock[];
}

// ── StepBar ───────────────────────────────────────────────────────────────────
const StepBar = ({
  chapters,
  currentIndex,
}: {
  chapters: ActiveChapter[];
  currentIndex: number;
}) => (
  <div className="mb-10">
    {/* Desktop */}
    <div className="hidden sm:flex items-start">
      {chapters.map((chapter, idx) => (
        <Fragment key={chapter.id}>
          {idx > 0 && (
            <div
              className={`flex-1 h-px mt-4 transition-colors duration-300 ${
                idx <= currentIndex ? "bg-primary" : "bg-border"
              }`}
            />
          )}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 ${
                idx < currentIndex
                  ? "bg-primary border-primary text-primary-foreground"
                  : idx === currentIndex
                  ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-background border-border text-muted-foreground"
              }`}
            >
              {idx < currentIndex ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </div>
            <span
              className={`text-xs font-medium transition-colors duration-200 ${
                idx === currentIndex ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {chapter.label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>

    {/* Mobile */}
    <div className="sm:hidden space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Chapter {currentIndex + 1} of {chapters.length}
        </span>
        <span className="font-semibold text-foreground">
          {chapters[currentIndex]?.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / chapters.length) * 100}%` }}
        />
      </div>
    </div>
  </div>
);

// ── SessionView ───────────────────────────────────────────────────────────────
export const SessionView = () => {
  const { programId, sessionId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { awardSessionXP, awardXP } = useXP();
  const { updateStreak } = useStreak(user?.id);

  const [session, setSession] = useState<SessionData | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [adjacentSessions, setAdjacentSessions] = useState<{
    prev: SessionData | null;
    next: SessionData | null;
  }>({ prev: null, next: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkedComplete, setIsMarkedComplete] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const [personalizedMap, setPersonalizedMap] = useState<Record<string, string>>({});
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  // ── Chapter grouping ────────────────────────────────────────────────────────
  const activeChapters = useMemo<ActiveChapter[]>(() => {
    if (contentBlocks.length === 0) return [];

    const chapterMap = new Map<ChapterId, ContentBlock[]>(
      CHAPTER_DEFS.map((def) => [def.id, []])
    );

    for (const block of contentBlocks) {
      const chapterId =
        CHAPTER_DEFS.find((def) => def.types.includes(block.block_type))?.id ??
        "introduction";
      chapterMap.get(chapterId)!.push(block);
    }

    return CHAPTER_DEFS.filter((def) => chapterMap.get(def.id)!.length > 0).map(
      (def) => ({ id: def.id, label: def.label, blocks: chapterMap.get(def.id)! })
    );
  }, [contentBlocks]);

  const isLastChapter = currentChapterIndex === activeChapters.length - 1;

  // ── localStorage: restore saved chapter ──────────────────────────────────────
  useEffect(() => {
    if (!sessionId || activeChapters.length === 0) return;
    const saved = localStorage.getItem(`kit-session-chapter-${sessionId}`);
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      if (!isNaN(idx) && idx < activeChapters.length) {
        setCurrentChapterIndex(idx);
      }
    }
  }, [sessionId, activeChapters.length]);

  // ── localStorage: persist on change ───────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(`kit-session-chapter-${sessionId}`, String(currentChapterIndex));
  }, [sessionId, currentChapterIndex]);

  const goNext = () =>
    setCurrentChapterIndex((i) => Math.min(i + 1, activeChapters.length - 1));
  const goBack = () => setCurrentChapterIndex((i) => Math.max(i - 1, 0));

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = async () => {
    setIsLoading(true);

    const [sessionResult, blocksResult, progressResult, xpTxResult] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
      supabase
        .from("content_blocks")
        .select("*")
        .eq("session_id", sessionId)
        .order("block_order"),
      user
        ? supabase
            .from("session_progress")
            .select("completed")
            .eq("session_id", sessionId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve(null),
      user
        ? supabase
            .from("xp_transactions")
            .select("id")
            .eq("user_id", user.id)
            .eq("reference_type", "session")
            .eq("reference_id", sessionId)
            .limit(1)
        : Promise.resolve(null),
    ]);

    const sessionData = sessionResult.data;
    const sessionError = sessionResult.error;

    if (sessionError) {
      console.error("Session fetch error:", sessionError);
      toast({
        title: "Failed to load session",
        description: sessionError.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (sessionData) setSession(sessionData);

    const blocks = blocksResult.data;
    const blocksError = blocksResult.error;

    if (blocksError) {
      console.error("Content blocks fetch error:", blocksError);
      toast({ title: "Failed to load content blocks", variant: "destructive" });
    }

    if (blocks && blocks.length > 0) {
      setContentBlocks(blocks);
    } else if (!blocksError) {
      console.warn("No content blocks returned — retrying...");
      let retryData = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const delay = 800 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        const { data: rb, error: re } = await supabase
          .from("content_blocks")
          .select("*")
          .eq("session_id", sessionId)
          .order("block_order");
        if (re) {
          console.error("Retry blocks error:", re);
          if (attempt === 2)
            toast({ title: "Content still unavailable after retry", variant: "destructive" });
          break;
        }
        if (rb && rb.length > 0) {
          retryData = rb;
          break;
        }
      }
      if (retryData) setContentBlocks(retryData);
    }

    setIsMarkedComplete(progressResult?.data?.completed || false);
    setXpAwarded(!!(xpTxResult?.data && xpTxResult.data.length > 0));

    if (sessionData) {
      const [
        programResult,
        allSessionsResult,
        progAccessResult,
        sessAccessResult,
        allProgressResult,
      ] = await Promise.all([
        supabase
          .from("programs")
          .select("id, title")
          .eq("id", sessionData.program_id)
          .maybeSingle(),
        supabase
          .from("sessions")
          .select("*")
          .eq("program_id", sessionData.program_id)
          .order("session_order"),
        user
          ? supabase
              .from("user_program_access")
              .select("expires_at")
              .eq("program_id", sessionData.program_id)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from("user_session_access")
              .select("session_id, expires_at")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        user
          ? supabase
              .from("session_progress")
              .select("session_id, completed")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (programResult.data) setProgram(programResult.data);

      // ── Access + sequential prerequisite guard (admins bypass) ──
      if (user && !isAdmin && allSessionsResult.data) {
        const nowMs = Date.now();
        const progRow = progAccessResult.data as { expires_at: string | null } | null;
        const programActive =
          !!progRow && (!progRow.expires_at || new Date(progRow.expires_at).getTime() > nowMs);
        const grantSet = new Set(
          ((sessAccessResult.data ?? []) as { session_id: string; expires_at: string | null }[])
            .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > nowMs)
            .map((r) => r.session_id)
        );
        const completedSet = new Set(
          ((allProgressResult.data ?? []) as { session_id: string; completed: boolean }[])
            .filter((p) => p.completed)
            .map((p) => p.session_id)
        );
        const isAccessible = (s: SessionData) =>
          s.is_free || programActive || grantSet.has(s.id);
        const isGranted = (s: SessionData) => programActive || grantSet.has(s.id);

        if (!isAccessible(sessionData)) {
          toast({
            title: "Locked",
            description: "You don't have access to this module.",
            variant: "destructive",
          });
          navigate(`/programs/${sessionData.program_id}`);
          return;
        }

        const earlierBlocked = (allSessionsResult.data as SessionData[]).some(
          (s) =>
            s.session_order < sessionData.session_order &&
            isGranted(s) &&
            !completedSet.has(s.id)
        );
        if (earlierBlocked) {
          toast({
            title: "Complete earlier modules first",
            description:
              "Finish the earlier modules you have access to before opening this one.",
            variant: "destructive",
          });
          navigate(`/programs/${sessionData.program_id}`);
          return;
        }
      }

      if (allSessionsResult.data) {
        const currentIndex = allSessionsResult.data.findIndex((s) => s.id === sessionId);
        setAdjacentSessions({
          prev: currentIndex > 0 ? allSessionsResult.data[currentIndex - 1] : null,
          next:
            currentIndex < allSessionsResult.data.length - 1
              ? allSessionsResult.data[currentIndex + 1]
              : null,
        });
      }
    }

    setIsLoading(false);

    if (user && sessionData) {
      personalizeContent(sessionData.program_id);
    }
  };

  useEffect(() => {
    if (sessionId && programId) {
      setShowQuiz(false);
      setCurrentChapterIndex(0);
      fetchData();
    }
  }, [sessionId, programId]);

  // ── Personalization ─────────────────────────────────────────────────────────
  const personalizeContent = async (progId: string) => {
    if (!user || !sessionId) return;
    setIsPersonalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("personalize-content", {
        body: { action: "personalize_session", sessionId, programId: progId },
      });

      if (!error && data?.personalized && Array.isArray(data.personalized)) {
        const map: Record<string, string> = {};
        for (const item of data.personalized) {
          if (item.id && item.content) {
            map[item.id] = item.content;
          } else if (item.original_block_id && item.personalized_text) {
            map[item.original_block_id] = item.personalized_text;
          }
        }
        setPersonalizedMap(map);
        setSkillLevel(data.skillLevel || null);
      }
    } catch (err) {
      console.error("Personalization error:", err);
      toast({
        title: "Content personalization failed",
        description: "Using default content",
        variant: "destructive",
      });
    } finally {
      setIsPersonalizing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!user || !sessionId || !session) return;
    setIsPersonalizing(true);
    try {
      await supabase.functions.invoke("personalize-content", {
        body: { action: "regenerate", sessionId },
      });
      setPersonalizedMap({});
      await personalizeContent(session.program_id);
    } catch (err) {
      console.error("Regeneration error:", err);
      toast({ title: "Content regeneration failed", variant: "destructive" });
    }
  };

  // ── Progress ────────────────────────────────────────────────────────────────
  const markComplete = async () => {
    if (!user || !sessionId) return;

    const { error } = await supabase.from("session_progress").upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        completed: true,
        completed_at: new Date().toISOString(),
        progress_percentage: 100,
      },
      { onConflict: "user_id,session_id" }
    );

    if (!error) {
      setIsMarkedComplete(true);
      setShowQuiz(true);
      if (!xpAwarded) {
        await awardSessionXP(user.id, sessionId);
        setXpAwarded(true);
      }
      updateStreak();
    }
  };

  const handleRetry = async () => {
    if (!user || !sessionId) return;
    setIsRetrying(true);
    const { error } = await supabase
      .from("session_progress")
      .update({ completed: false, completed_at: null, progress_percentage: 0 })
      .eq("user_id", user.id)
      .eq("session_id", sessionId);

    if (!error) {
      setIsMarkedComplete(false);
      setCurrentChapterIndex(0);
      localStorage.removeItem(`kit-session-chapter-${sessionId}`);
    }
    setIsRetrying(false);
  };

  const handleQuizComplete = async (score: number) => {
    if (!user || !sessionId) return;
    if (score >= 60) {
      await awardXP(user.id, 10, "Passed session quiz", "session_quiz", sessionId);
    }
    toast({
      title: `Quiz Score: ${score}%`,
      description: score >= 80 ? "Excellent work!" : "Keep practicing to improve your score.",
    });
  };

  // ── Render guards ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!session || !program) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <Button asChild>
            <Link to="/programs">Back to Programs</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (showQuiz) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-4xl">
          <SessionQuiz
            sessionId={session.id}
            programId={session.program_id}
            sessionTitle={session.title}
            onClose={() => setShowQuiz(false)}
            onComplete={handleQuizComplete}
          />
        </main>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            to={`/programs/${program.id}`}
            className="hover:text-foreground transition-colors"
          >
            {program.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">Session {session.session_order}</span>
        </div>

        {/* Session Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              Session {session.session_order}
            </span>
            {session.is_free && (
              <Badge variant="secondary" className="text-xs">
                Free
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">{session.title}</h1>
          {session.description && (
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              {session.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{session.duration_minutes || 30} min</span>
            </div>
            {skillLevel && (
              <Badge variant="outline" className="capitalize flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {skillLevel}
              </Badge>
            )}
            {skillLevel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                onClick={handleRegenerate}
                disabled={isPersonalizing}
                title="Regenerate personalized content"
                aria-label="Regenerate personalized content"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${isPersonalizing ? "animate-spin" : ""}`}
                />
                <span className="text-xs">Personalize</span>
              </Button>
            )}
          </div>
          {isPersonalizing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Personalizing content for your level...
            </div>
          )}
        </div>
        <Separator className="mb-10" />

        {/* Empty state */}
        {contentBlocks.length === 0 && !session.simulation_url && (
          <div className="text-center py-12 bg-card rounded-xl border border-border space-y-4">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-medium">Content not loaded yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              This can happen right after unlocking a program. Click below to refresh.
            </p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Content
            </Button>
          </div>
        )}

        {/* Stepped chapters with scrollable content */}
        {activeChapters.length > 0 && (
          <>
            <StepBar chapters={activeChapters} currentIndex={currentChapterIndex} />

            {/* Chapter content — all blocks in chapter visible */}
            <div className="animate-in fade-in duration-300 space-y-8">
              {activeChapters[currentChapterIndex].blocks.map((block) => (
                <div key={block.id} className="space-y-3">
                  <ContentBlockRenderer
                    block={
                      personalizedMap[block.id]
                        ? { ...block, content: personalizedMap[block.id] }
                        : block
                    }
                  />
                  <ContentBlockAttachments blockId={block.id} />
                </div>
              ))}

              {/* Simulation embed appears on the last chapter only */}
              {isLastChapter && session.simulation_url && (
                <SimulationEmbed url={session.simulation_url} title="Circuit Simulation" />
              )}
            </div>

            {/* Chapter navigation */}
            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={goBack}
                className={currentChapterIndex === 0 ? "invisible" : ""}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {isLastChapter ? (
                isMarkedComplete ? (
                  <div className="flex items-center gap-2">
                    <Button variant="accent" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete!
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowQuiz(true)}>
                      <Brain className="h-4 w-4 mr-2" />
                      Quiz
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isRetrying}
                    >
                      {isRetrying ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Retry
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={markComplete}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Complete
                  </Button>
                )
              ) : (
                <Button variant="hero" onClick={goNext}>
                  Next Chapter
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </>
        )}

        {/* Session navigation (prev / next session in program) */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          {adjacentSessions.prev ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/programs/${program.id}/session/${adjacentSessions.prev.id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {adjacentSessions.prev.title}
              </Link>
            </Button>
          ) : (
            <div />
          )}
          {adjacentSessions.next && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/programs/${program.id}/session/${adjacentSessions.next.id}`}>
                {adjacentSessions.next.title}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default SessionView;
