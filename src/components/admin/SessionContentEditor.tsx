import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentBlockDialog } from "./ContentBlockDialog";
import { 
  FileText, 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical,
  Image,
  Code,
  AlertTriangle,
  Lightbulb,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Check,
  Target,
  Zap,
  Cpu,
  CircuitBoard,
  HelpCircle,
  MessageSquare,
  FolderPlus,
  MoveRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Program {
  id: string;
  title: string;
  kit_id: string | null;
  category: string | null;
  difficulty_level: string | null;
}

interface Session {
  id: string;
  program_id: string;
  title: string;
  session_order: number;
  is_free: boolean;
  xp_cost: number | null;
}

interface ContentBlock {
  id: string;
  session_id: string;
   block_type: "text" | "image" | "code" | "diagram" | "video" | "safety_note" | "tip" | "problem" | "solution" | "components" | "circuit_diagram" | "questions" | "feedback" | "introduction" | "simulation";
  block_order: number;
  title: string | null;
  content: string | null;
  code_language: string | null;
  image_url: string | null;
}

interface GeneratedBlock {
   type: "text" | "code" | "tip" | "safety_note" | "image" | "problem" | "solution" | "components" | "circuit_diagram" | "questions" | "feedback" | "introduction" | "simulation";
  title?: string;
  content: string;
  codeLanguage?: string;
  imageUrl?: string;
}

interface GeneratedSessionContent {
  sessionTitle: string;
  blocks: GeneratedBlock[];
}

interface SessionContentEditorProps {
  generatedContent?: GeneratedSessionContent[] | null;
  onContentProcessed?: () => void;
}

export interface SessionContentEditorRef {
  loadGeneratedContent: (content: GeneratedSessionContent[]) => void;
}

const blockTypeIcons = {
  text: FileText,
  image: Image,
  code: Code,
  diagram: Image,
  video: FileText,
  safety_note: AlertTriangle,
  tip: Lightbulb,
  problem: Target,
  solution: Zap,
  components: Cpu,
  circuit_diagram: CircuitBoard,
  questions: HelpCircle,
  feedback: MessageSquare,
   introduction: FileText,
   simulation: CircuitBoard,
};

const blockTypeLabels: Record<string, string> = {
  problem: "Problem Statement",
  introduction: "Introduction",
  solution: "Solution",
  components: "Components List",
  circuit_diagram: "Circuit Diagram",
  code: "Code",
  simulation: "Simulation",
  questions: "Review Questions",
  feedback: "Feedback & Next Steps",
  text: "Text",
  image: "Image",
  tip: "Tip",
  safety_note: "Safety Note",
  diagram: "Diagram",
  video: "Video",
};

export const SessionContentEditor = forwardRef<SessionContentEditorRef, SessionContentEditorProps>(
  ({ generatedContent, onContentProcessed }, ref) => {
    const [programs, setPrograms] = useState<Program[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
    const [pendingContent, setPendingContent] = useState<GeneratedSessionContent[] | null>(null);
    
    const [selectedProgram, setSelectedProgram] = useState<string>("");
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
    const [isAutoPopulating, setIsAutoPopulating] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingGenerated, setIsSavingGenerated] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
    
    // Move block dialog state
    const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
    const [movingBlock, setMovingBlock] = useState<ContentBlock | null>(null);
    const [moveTargetSession, setMoveTargetSession] = useState<string>("");
    const [allSessions, setAllSessions] = useState<Session[]>([]);
    
    // New session dialog state
    const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [sessionForm, setSessionForm] = useState({
      title: "",
      description: "",
      session_order: 1,
      is_free: false,
      duration_minutes: 30,
      xp_cost: 15,
    });
    
    const [blockForm, setBlockForm] = useState({
      block_type: "text" as ContentBlock["block_type"],
      title: "",
      content: "",
      code_language: "arduino",
      image_url: "",
    });
    
    const { toast } = useToast();

    // Expose method to parent via ref
    useImperativeHandle(ref, () => ({
      loadGeneratedContent: (content: GeneratedSessionContent[]) => {
        setPendingContent(content);
      }
    }));

    // Load generated content when received
    useEffect(() => {
      if (generatedContent && generatedContent.length > 0) {
        setPendingContent(generatedContent);
      }
    }, [generatedContent]);

    useEffect(() => {
      fetchPrograms();
    }, []);

    useEffect(() => {
      if (selectedProgram) {
        fetchSessions(selectedProgram);
      }
    }, [selectedProgram]);

    useEffect(() => {
      if (selectedSession) {
        fetchContentBlocks(selectedSession);
      }
    }, [selectedSession]);

    const fetchPrograms = async () => {
      const { data } = await supabase
        .from("programs")
        .select("id, title, kit_id, category, difficulty_level")
        .order("title");
      if (data) setPrograms(data as Program[]);
      setIsLoading(false);
    };

    const fetchSessions = async (programId: string) => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("program_id", programId)
        .order("session_order");
      if (data) setSessions(data as Session[]);
    };

    const fetchContentBlocks = async (sessionId: string) => {
      const { data } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("session_id", sessionId)
        .order("block_order");
      if (data) setContentBlocks(data as ContentBlock[]);
    };

    const handleAddBlock = () => {
      setEditingBlock(null);
      setBlockForm({
        block_type: "text",
        title: "",
        content: "",
        code_language: "arduino",
        image_url: "",
      });
      setIsDialogOpen(true);
    };

    const handleEditBlock = (block: ContentBlock) => {
      setEditingBlock(block);
      setBlockForm({
        block_type: block.block_type,
        title: block.title || "",
        content: block.content || "",
        code_language: block.code_language || "arduino",
        image_url: block.image_url || "",
      });
      setIsDialogOpen(true);
    };

    const handleSaveBlock = async () => {
      if (!selectedSession) return;
      
      setIsSaving(true);

      if (editingBlock) {
        const { error } = await supabase
          .from("content_blocks")
          .update({
            block_type: blockForm.block_type,
            title: blockForm.title || null,
            content: blockForm.content || null,
            code_language: blockForm.block_type === "code" ? blockForm.code_language : null,
            image_url: blockForm.block_type === "image" ? blockForm.image_url : null,
          })
          .eq("id", editingBlock.id);

        if (error) {
          toast({ title: "Error", description: "Failed to update block.", variant: "destructive" });
        } else {
          toast({ title: "Block Updated", description: "Content block saved successfully." });
          fetchContentBlocks(selectedSession);
        }
      } else {
        const maxOrder = Math.max(0, ...contentBlocks.map(b => b.block_order));
        
        const { error } = await supabase
          .from("content_blocks")
          .insert({
            session_id: selectedSession,
            block_type: blockForm.block_type,
            block_order: maxOrder + 1,
            title: blockForm.title || null,
            content: blockForm.content || null,
            code_language: blockForm.block_type === "code" ? blockForm.code_language : null,
            image_url: blockForm.block_type === "image" ? blockForm.image_url : null,
          });

        if (error) {
          toast({ title: "Error", description: "Failed to add block.", variant: "destructive" });
        } else {
          toast({ title: "Block Added", description: "New content block created." });
          fetchContentBlocks(selectedSession);
        }
      }

      setIsSaving(false);
      setIsDialogOpen(false);
    };

    const handleDeleteBlock = async (blockId: string) => {
      const { error } = await supabase
        .from("content_blocks")
        .delete()
        .eq("id", blockId);

      if (error) {
        toast({ title: "Error", description: "Failed to delete block.", variant: "destructive" });
      } else {
        toast({ title: "Block Deleted", description: "Content block removed." });
        fetchContentBlocks(selectedSession);
      }
    };

    const handleMoveBlock = async (block: ContentBlock) => {
      setMovingBlock(block);
      setMoveTargetSession("");
      // Fetch all sessions across all programs for move target
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .order("session_order");
      if (data) setAllSessions(data as Session[]);
      setIsMoveDialogOpen(true);
    };

    const confirmMoveBlock = async () => {
      if (!movingBlock || !moveTargetSession) return;
      setIsSaving(true);
      
      // Get max block_order in target session
      const { data: targetBlocks } = await supabase
        .from("content_blocks")
        .select("block_order")
        .eq("session_id", moveTargetSession)
        .order("block_order", { ascending: false })
        .limit(1);
      
      const newOrder = (targetBlocks?.[0]?.block_order || 0) + 1;
      
      const { error } = await supabase
        .from("content_blocks")
        .update({ session_id: moveTargetSession, block_order: newOrder })
        .eq("id", movingBlock.id);
      
      if (error) {
        toast({ title: "Error", description: "Failed to move block.", variant: "destructive" });
      } else {
        toast({ title: "Block Moved", description: "Content block moved to the selected session." });
        if (selectedSession) fetchContentBlocks(selectedSession);
      }
      
      setIsSaving(false);
      setIsMoveDialogOpen(false);
      setMovingBlock(null);
    };

    const toggleSessionExpand = (sessionId: string) => {
      const newExpanded = new Set(expandedSessions);
      if (newExpanded.has(sessionId)) {
        newExpanded.delete(sessionId);
      } else {
        newExpanded.add(sessionId);
        setSelectedSession(sessionId);
      }
      setExpandedSessions(newExpanded);
    };

    const saveGeneratedContentToSession = async (sessionId: string, sessionContent: GeneratedSessionContent) => {
      setIsSavingGenerated(true);
      
      try {
        // Get current max block order
        const { data: existingBlocks } = await supabase
          .from("content_blocks")
          .select("block_order")
          .eq("session_id", sessionId)
          .order("block_order", { ascending: false })
          .limit(1);
        
        let blockOrder = (existingBlocks?.[0]?.block_order || 0) + 1;
        
        // Insert all blocks for this session
        for (const block of sessionContent.blocks) {
          await supabase
            .from("content_blocks")
            .insert({
              session_id: sessionId,
              block_type: block.type as ContentBlock["block_type"],
              block_order: blockOrder++,
              title: block.title || null,
              content: block.content,
              code_language: block.type === "code" ? (block.codeLanguage || "arduino") : null,
            });
        }

        toast({
          title: "Content Saved",
          description: `${sessionContent.blocks.length} blocks saved to session.`
        });
        
        fetchContentBlocks(sessionId);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save generated content.",
          variant: "destructive"
        });
      } finally {
        setIsSavingGenerated(false);
      }
    };

    const matchAndSaveContent = (session: Session, content: GeneratedSessionContent) => {
      saveGeneratedContentToSession(session.id, content);
    };

    const dismissPendingContent = () => {
      setPendingContent(null);
      if (onContentProcessed) {
        onContentProcessed();
      }
    };

    // Auto-populate sessions from AI-generated content
    const autoPopulateSessions = async () => {
      if (!pendingContent || pendingContent.length === 0 || !selectedProgram) {
        toast({
          title: "Cannot Auto-Populate",
          description: "Please select a program and ensure AI content is generated first.",
          variant: "destructive"
        });
        return;
      }

      setIsAutoPopulating(true);

      try {
        // Delete existing sessions for this program first
        const { error: deleteError } = await supabase
          .from("sessions")
          .delete()
          .eq("program_id", selectedProgram);

        if (deleteError) {
          console.error("Error deleting existing sessions:", deleteError);
          toast({ title: "Failed to clear existing sessions", variant: "destructive" });
        }

        // Create sessions for each piece of content
        for (let i = 0; i < pendingContent.length; i++) {
          const sessionContent = pendingContent[i];
          const sessionOrder = i + 1;

          // Create new session
          const { data: newSession, error: sessionError } = await supabase
            .from("sessions")
            .insert({
              program_id: selectedProgram,
              title: sessionContent.sessionTitle,
              session_order: sessionOrder,
              is_free: sessionOrder === 1, // First session is free
              duration_minutes: 30
            })
            .select()
            .maybeSingle();

          if (sessionError || !newSession) {
            console.error("Error creating session:", sessionError);
            toast({ title: "Failed to create session", description: sessionError?.message, variant: "destructive" });
            continue;
          }

          // Insert all content blocks for this session
          let blockOrder = 1;
          for (const block of sessionContent.blocks) {
            await supabase
              .from("content_blocks")
              .insert({
                session_id: newSession.id,
                block_type: block.type as ContentBlock["block_type"],
                block_order: blockOrder++,
                title: block.title || null,
                content: block.content,
                code_language: block.type === "code" ? (block.codeLanguage || "arduino") : null,
                image_url: block.imageUrl || null
              });
          }
        }

        // Update program total_sessions count
        await supabase
          .from("programs")
          .update({ total_sessions: pendingContent.length })
          .eq("id", selectedProgram);

        toast({
          title: "Sessions Auto-Populated",
          description: `Successfully created ${pendingContent.length} sessions with all content blocks.`
        });

        // Refresh sessions list
        fetchSessions(selectedProgram);
        setPendingContent(null);
        if (onContentProcessed) {
          onContentProcessed();
        }
      } catch (error) {
        console.error("Auto-populate error:", error);
        toast({
          title: "Error",
          description: "Failed to auto-populate sessions. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsAutoPopulating(false);
      }
    };

    const handleAddSession = () => {
      setEditingSession(null);
      setSessionForm({
        title: "",
        description: "",
        session_order: sessions.length + 1,
        is_free: sessions.length < 2,
        duration_minutes: 30,
        xp_cost: 15,
      });
      setIsSessionDialogOpen(true);
    };

    const handleEditSession = (session: Session) => {
      setEditingSession(session);
      setSessionForm({
        title: session.title,
        description: "",
        session_order: session.session_order,
        is_free: session.is_free,
        duration_minutes: 30,
        xp_cost: session.xp_cost ?? 0,
      });
      setIsSessionDialogOpen(true);
    };

    const handleSaveSession = async () => {
      if (!selectedProgram || !sessionForm.title.trim()) return;
      setIsSaving(true);

      if (editingSession) {
        const { error } = await supabase
          .from("sessions")
          .update({
            title: sessionForm.title,
            session_order: sessionForm.session_order,
            is_free: sessionForm.is_free,
            duration_minutes: sessionForm.duration_minutes,
            xp_cost: (!sessionForm.is_free && sessionForm.xp_cost > 0) ? sessionForm.xp_cost : null,
          })
          .eq("id", editingSession.id);

        if (error) {
          toast({ title: "Error", description: "Failed to update session.", variant: "destructive" });
        } else {
          toast({ title: "Session Updated", description: "Session details saved." });
          fetchSessions(selectedProgram);
        }
      } else {
        const { error } = await supabase
          .from("sessions")
          .insert({
            program_id: selectedProgram,
            title: sessionForm.title,
            session_order: sessionForm.session_order,
            is_free: sessionForm.is_free,
            duration_minutes: sessionForm.duration_minutes,
            xp_cost: (!sessionForm.is_free && sessionForm.xp_cost > 0) ? sessionForm.xp_cost : null,
          });

        if (error) {
          toast({ title: "Error", description: "Failed to create session.", variant: "destructive" });
        } else {
          toast({ title: "Session Created", description: `"${sessionForm.title}" has been added.` });
          fetchSessions(selectedProgram);
        }
      }

      setIsSaving(false);
      setIsSessionDialogOpen(false);
    };

    const handleDeleteSession = async (sessionId: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
      if (error) {
        toast({ title: "Error", description: "Failed to delete session.", variant: "destructive" });
      } else {
        toast({ title: "Session Deleted", description: "Session and its content removed." });
        fetchSessions(selectedProgram);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Session Content Editor</h2>
            <p className="text-sm text-muted-foreground">
              Add sessions manually or auto-create from AI-generated content
            </p>
          </div>
        </div>

        {/* Program Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Program</CardTitle>
            <CardDescription>
              Choose a program to manage its sessions and content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Select a program..." />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    <div className="flex items-center gap-2">
                      <span>{program.title}</span>
                      {program.difficulty_level && (
                        <Badge variant="outline" className="text-xs">
                          {program.difficulty_level}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* AI Generated Content Panel */}
        {pendingContent && pendingContent.length > 0 && (
          <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">AI-Generated Content Ready</CardTitle>
                    <CardDescription>
                      {pendingContent.length} session(s) will be created automatically
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="hero" 
                    onClick={autoPopulateSessions}
                    disabled={isAutoPopulating || !selectedProgram}
                  >
                    {isAutoPopulating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Sessions...
                      </>
                    ) : (
                      <>
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Create All Sessions
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={dismissPendingContent}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {pendingContent.map((content, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-lg bg-background border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{content.sessionTitle}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {content.blocks.slice(0, 4).map((block, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {blockTypeLabels[block.type] || block.type}
                            </Badge>
                          ))}
                          {content.blocks.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{content.blocks.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-primary/20 text-primary">
                      {content.blocks.length} blocks
                    </Badge>
                  </div>
                ))}
              </div>
              {!selectedProgram && (
                <p className="text-sm text-warning mt-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Please select a program above before creating sessions
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sessions List with Content */}
        {selectedProgram && sessions.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Sessions ({sessions.length})</h3>
              <Button variant="outline" size="sm" onClick={handleAddSession}>
                <Plus className="h-4 w-4 mr-2" />
                Add Session
              </Button>
            </div>
            {sessions.map((session) => {
              // Find matching generated content for this session
              const matchingContent = pendingContent?.find(c => 
                c.sessionTitle.toLowerCase().includes(session.title.toLowerCase()) ||
                session.title.toLowerCase().includes(c.sessionTitle.toLowerCase()) ||
                c.sessionTitle.includes(`${session.session_order}`)
              );

              return (
                <div key={session.id} className={`rounded-xl bg-card border overflow-hidden ${
                  matchingContent ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'
                }`}>
                  <button
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    onClick={() => toggleSessionExpand(session.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedSessions.has(session.id) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        Session {session.session_order}: {session.title}
                      </span>
                      {session.is_free && (
                         <span className="text-xs px-2 py-0.5 rounded bg-accent/30 text-accent-foreground">
                          Free
                        </span>
                      )}
                      {matchingContent && (
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI content available
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleEditSession(session)} aria-label="Edit session">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteSession(session.id)} aria-label="Delete session">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>

                  {expandedSessions.has(session.id) && selectedSession === session.id && (
                    <div className="border-t border-border p-4 space-y-4">
                      {/* Show AI content import option */}
                      {matchingContent && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">
                                Import AI Content: {matchingContent.sessionTitle}
                              </span>
                            </div>
                            <Button
                              variant="hero"
                              size="sm"
                              onClick={() => matchAndSaveContent(session, matchingContent)}
                              disabled={isSavingGenerated}
                            >
                              {isSavingGenerated ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Import {matchingContent.blocks.length} blocks
                                </>
                              )}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {matchingContent.blocks.slice(0, 3).map((block, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="capitalize text-primary">{block.type}</span>
                                <span>- {block.title || block.content.substring(0, 50)}...</span>
                              </div>
                            ))}
                            {matchingContent.blocks.length > 3 && (
                              <div className="text-muted-foreground">
                                +{matchingContent.blocks.length - 3} more blocks...
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {contentBlocks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No content blocks yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {contentBlocks.map((block) => {
                            const Icon = blockTypeIcons[block.block_type] || FileText;
                            return (
                              <div
                                key={block.id}
                                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 group"
                              >
                                <GripVertical className="h-5 w-5 mt-1 text-muted-foreground cursor-move" />
                                <Icon className="h-5 w-5 mt-1 text-primary" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">
                                    {block.title || `${block.block_type} block`}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {block.content?.substring(0, 100) || block.image_url || "No content"}
                                  </p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    title="Move to another session"
                                    onClick={() => handleMoveBlock(block)}
                                  >
                                    <MoveRight className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleEditBlock(block)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-destructive"
                                    onClick={() => handleDeleteBlock(block.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <Button variant="outline" className="w-full" onClick={handleAddBlock}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Content Block
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : selectedProgram ? (
          <div className="text-center p-12 rounded-xl bg-card border border-border">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No sessions found for this program.</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add sessions manually or use the AI Assistant tab to generate content.
            </p>
            <Button variant="hero" onClick={handleAddSession}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Session
            </Button>
          </div>
        ) : !selectedProgram ? (
          <div className="text-center p-12 rounded-xl bg-card border border-border">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Select a program above to view and manage sessions.</p>
          </div>
        ) : null}

        <ContentBlockDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingBlock={editingBlock}
          blockForm={blockForm}
          setBlockForm={setBlockForm}
          isSaving={isSaving}
          onSave={handleSaveBlock}
        />

        {/* Move Block Dialog */}
        <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MoveRight className="h-5 w-5" />
                Move Content Block
              </DialogTitle>
              <DialogDescription>
                Move "{movingBlock?.title || movingBlock?.block_type}" to another session.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Target Session</Label>
                <Select value={moveTargetSession} onValueChange={setMoveTargetSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allSessions
                      .filter(s => s.id !== movingBlock?.session_id)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Session {s.session_order}: {s.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={confirmMoveBlock} disabled={isSaving || !moveTargetSession}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Moving...
                  </>
                ) : (
                  <>
                    <MoveRight className="mr-2 h-4 w-4" />
                    Move Block
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Session Dialog */}
        <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingSession ? "Edit Session" : "Add New Session"}</DialogTitle>
              <DialogDescription>
                {editingSession ? "Update session details." : "Create a new session with topic and subtitle."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Session Title / Topic</Label>
                <Input
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  placeholder="e.g., Introduction to Arduino"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Session Order</Label>
                  <Input
                    type="number"
                    value={sessionForm.session_order}
                    onChange={(e) => setSessionForm({ ...sessionForm, session_order: parseInt(e.target.value) || 1 })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={sessionForm.duration_minutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, duration_minutes: parseInt(e.target.value) || 30 })}
                    min={5}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unlock cost (XP)</Label>
                <Input
                  type="number"
                  value={sessionForm.xp_cost}
                  onChange={(e) => setSessionForm({ ...sessionForm, xp_cost: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={0}
                  disabled={sessionForm.is_free}
                  placeholder="0 = no XP required"
                />
                <p className="text-xs text-muted-foreground">
                  Spendable XP a learner must pay to unlock this session. The previous session must also be
                  completed first. Keep this at or below 20 (what completing a session pays) so learners are
                  never stuck — recommended 15. Set to 0 for no cost.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is-free"
                  checked={sessionForm.is_free}
                  onChange={(e) => setSessionForm({ ...sessionForm, is_free: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is-free" className="text-sm">Free session (accessible without unlock code)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSessionDialogOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={handleSaveSession} disabled={isSaving || !sessionForm.title.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingSession ? "Save Changes" : "Add Session"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

SessionContentEditor.displayName = "SessionContentEditor";

export default SessionContentEditor;


