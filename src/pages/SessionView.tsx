import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  Play,
  MessageCircle,
  Lightbulb,
   AlertTriangle,
   Loader2,
   Brain,
   RefreshCw,
   BookOpen
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
 

 interface SessionData {
   id: string;
   title: string;
   description: string | null;
   duration_minutes: number | null;
   session_order: number;
   program_id: string;
   simulation_url: string | null;
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

export const SessionView = () => {
  const { programId, sessionId } = useParams();
   const { user } = useAuth();
  const { toast } = useToast();
  const { awardQuizXP, awardSessionXP } = useXP();
  const { updateStreak } = useStreak(user?.id);
   const [session, setSession] = useState<SessionData | null>(null);
   const [program, setProgram] = useState<Program | null>(null);
   const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
   const [adjacentSessions, setAdjacentSessions] = useState<{prev: SessionData | null, next: SessionData | null}>({prev: null, next: null});
   const [isLoading, setIsLoading] = useState(true);
   const [isMarkedComplete, setIsMarkedComplete] = useState(false);
   const [personalizedMap, setPersonalizedMap] = useState<Record<string, string>>({});
   const [skillLevel, setSkillLevel] = useState<string | null>(null);
   const [isPersonalizing, setIsPersonalizing] = useState(false);
   const [showQuiz, setShowQuiz] = useState(false);
 
   const fetchData = async () => {
     setIsLoading(true);
     
     // Fetch session
     const { data: sessionData, error: sessionError } = await supabase
       .from("sessions")
       .select("*")
       .eq("id", sessionId)
       .maybeSingle();
     
     if (sessionError) {
       console.error("Session fetch error:", sessionError);
       setIsLoading(false);
       return;
     }

     if (sessionData) {
       setSession(sessionData);
       
       // Fetch program
       const { data: programData } = await supabase
         .from("programs")
         .select("id, title")
         .eq("id", sessionData.program_id)
         .maybeSingle();
       
       if (programData) {
         setProgram(programData);
       }
 
       // Fetch adjacent sessions
       const { data: allSessions } = await supabase
         .from("sessions")
         .select("*")
         .eq("program_id", sessionData.program_id)
         .order("session_order");
       
       if (allSessions) {
         const currentIndex = allSessions.findIndex(s => s.id === sessionId);
         setAdjacentSessions({
           prev: currentIndex > 0 ? allSessions[currentIndex - 1] : null,
           next: currentIndex < allSessions.length - 1 ? allSessions[currentIndex + 1] : null
         });
       }
     }
     
     // Fetch content blocks
     const { data: blocks, error: blocksError } = await supabase
       .from("content_blocks")
       .select("*")
       .eq("session_id", sessionId)
       .order("block_order");
     
     if (blocksError) {
       console.error("Content blocks fetch error:", blocksError);
     }

     if (blocks && blocks.length > 0) {
       setContentBlocks(blocks);
     } else if (!blocksError) {
       console.warn("No content blocks returned — retrying...");
       await new Promise(r => setTimeout(r, 800));
       const { data: retryBlocks, error: retryError } = await supabase
         .from("content_blocks")
         .select("*")
         .eq("session_id", sessionId)
         .order("block_order");
       if (retryError) console.error("Retry blocks error:", retryError);
       if (retryBlocks) setContentBlocks(retryBlocks);
     }
 
     // Check if marked complete
     if (user) {
       const { data: progress } = await supabase
         .from("session_progress")
         .select("completed")
         .eq("session_id", sessionId)
         .eq("user_id", user.id)
         .maybeSingle();
       
       setIsMarkedComplete(progress?.completed || false);
     }
     
      setIsLoading(false);
      
      // Personalize content after loading
      if (user && sessionData) {
        personalizeContent(sessionData.program_id);
      }
     };

   useEffect(() => {
     if (sessionId && programId) {
       setShowQuiz(false);
       fetchData();
     }
   }, [sessionId, programId]);

   const personalizeContent = async (progId: string) => {
      if (!user || !sessionId) return;
      setIsPersonalizing(true);
      try {
        const { data, error } = await supabase.functions.invoke("personalize-content", {
          body: {
            action: "personalize_session",
            sessionId,
            programId: progId,
          },
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
      }
    };

    const markComplete = async () => {
      if (!user || !sessionId) return;
      
      const { error } = await supabase
        .from("session_progress")
        .upsert({
          user_id: user.id,
          session_id: sessionId,
          completed: true,
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
        }, { onConflict: "user_id,session_id" });
      
      if (!error) {
        setIsMarkedComplete(true);
        setShowQuiz(true);
        awardSessionXP(user.id, sessionId);
        updateStreak();
    }
  };

  const handleQuizComplete = async (score: number) => {
    if (!user || !sessionId) return;
    const passed = score >= 60;
    if (passed) {
      await awardXP(user.id, 10, "Passed session quiz", "session_quiz", sessionId);
    }
    toast({
      title: `Quiz Score: ${score}%`,
      description: score >= 80 ? "Excellent work!" : "Keep practicing to improve your score.",
    });
  };

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

   // Show quiz after marking complete
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <span>/</span>
           <Link to={`/programs/${program.id}`} className="hover:text-foreground transition-colors">
             {program.title}
          </Link>
          <span>/</span>
           <span className="text-foreground">Session {session.session_order}</span>
        </div>

        {/* Session Header */}
        <div className="bg-card rounded-xl p-6 border border-border mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
               <span className="text-sm text-primary font-medium">Session {session.session_order}</span>
              <h1 className="text-2xl font-bold mt-1">{session.title}</h1>
               {session.description && (
                 <p className="text-muted-foreground mt-2">{session.description}</p>
               )}
             </div>
             <div className="flex items-center gap-3">
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
                   onClick={handleRegenerate}
                   disabled={isPersonalizing}
                   title="Regenerate personalized content"
                 >
                   <RefreshCw className={`h-4 w-4 ${isPersonalizing ? "animate-spin" : ""}`} />
                 </Button>
               )}
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <Code2 className="h-4 w-4" />
                 {session.duration_minutes || 30} min
               </div>
             </div>
           </div>
           {isPersonalizing && (
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <Loader2 className="h-4 w-4 animate-spin" />
               Personalizing content for your level...
             </div>
           )}
         </div>

         {/* Content Blocks */}
        <div className="space-y-6">
           {contentBlocks.map((block) => (
             <ContentBlockRenderer 
               key={block.id} 
               block={personalizedMap[block.id] ? { ...block, content: personalizedMap[block.id] } : block} 
             />
           ))}
           
           {/* Simulation Embed */}
           {session.simulation_url && (
             <SimulationEmbed url={session.simulation_url} title="Circuit Simulation" />
           )}
           
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
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-8 border-t border-border">
           {adjacentSessions.prev ? (
            <Button variant="outline" asChild>
               <Link to={`/programs/${program.id}/session/${adjacentSessions.prev.id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                 {adjacentSessions.prev.title}
              </Link>
            </Button>
          ) : (
            <div />
          )}
          
           {adjacentSessions.next && (
            <Button variant="hero" asChild>
               <Link to={`/programs/${program.id}/session/${adjacentSessions.next.id}`}>
                 {adjacentSessions.next.title}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>

        {/* Mark Complete Button */}
        <div className="mt-8 text-center">
          {isMarkedComplete ? (
            <div className="space-y-3">
              <Button variant="accent" size="lg" disabled>
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Session Complete!
              </Button>
              <div>
                <Button variant="outline" size="sm" onClick={() => setShowQuiz(true)}>
                  <Brain className="h-4 w-4 mr-2" />
                  View / Redo Session Quiz
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="lg" onClick={markComplete}>
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Mark as Complete
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default SessionView;
