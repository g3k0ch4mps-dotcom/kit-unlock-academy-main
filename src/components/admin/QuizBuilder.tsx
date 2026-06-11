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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface Program {
  id: string;
  title: string;
}

interface Session {
  id: string;
  title: string;
  session_order: number;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

export const QuizBuilder = () => {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [passingScore, setPassingScore] = useState(70);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingQuizId, setExistingQuizId] = useState<string | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchSessions(selectedProgram);
      setSelectedSession("");
      setQuestions([]);
      setExistingQuizId(null);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedSession) {
      loadQuiz();
    } else {
      setQuestions([]);
      setExistingQuizId(null);
    }
  }, [selectedSession]);

  const fetchPrograms = async () => {
    const { data } = await supabase
      .from("programs")
      .select("id, title")
      .order("title");
    if (data) setPrograms(data);
    setIsLoading(false);
  };

  const fetchSessions = async (programId: string) => {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, session_order")
      .eq("program_id", programId)
      .order("session_order");
    if (data) setSessions(data);
  };

  const loadQuiz = async () => {
    const { data } = await supabase
      .from("session_quizzes")
      .select("*")
      .eq("session_id", selectedSession)
      .maybeSingle();

    if (data) {
      setExistingQuizId(data.id);
      setQuestions((data.questions as QuizQuestion[]) || []);
      setPassingScore(data.passing_score);
    } else {
      setExistingQuizId(null);
      setQuestions([]);
      setPassingScore(70);
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: "",
        options: ["", "", "", ""],
        correct_index: 0,
      },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: string, value: string | number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qId: string, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o, i) => (i === optIndex ? value : o)) }
          : q
      )
    );
  };

  const handleGenerateQuestions = async () => {
    if (!selectedSession) return;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-quiz-questions",
        { body: { sessionId: selectedSession } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.questions) {
        setQuestions(data.questions);
        setExistingQuizId(data.quiz_id);
        toast({
          title: "Success!",
          description: `Generated ${data.questions_count} questions. Review and save when ready.`,
        });
      }
    } catch (err) {
      console.error("Quiz generation failed:", err);
      // supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
      // real body lives on .context — pull the actual message out when present.
      let description =
        err instanceof Error ? err.message : "Failed to generate questions. Please try again.";
      if (err && typeof err === "object" && "context" in err) {
        try {
          const body = await (err as { context: Response }).context.json();
          if (body?.error) description = body.error;
        } catch {
          /* keep the fallback message */
        }
      }
      toast({ title: "Failed to generate questions", description, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSession) return;
    setIsSaving(true);

    const payload = {
      session_id: selectedSession,
      title: "Session Quiz",
      questions: questions as any,
      passing_score: passingScore,
    };

    const { error } = existingQuizId
      ? await supabase
          .from("session_quizzes")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existingQuizId)
      : await supabase.from("session_quizzes").insert(payload);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save quiz.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Quiz saved successfully!" });
      loadQuiz();
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Program</Label>
          <Select
            value={selectedProgram}
            onValueChange={setSelectedProgram}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a program..." />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Session</Label>
          <Select
            value={selectedSession}
            onValueChange={setSelectedSession}
            disabled={!selectedProgram}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a session..." />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Session {s.session_order}: {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSession && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Quiz Questions
              </h3>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Passing Score:</Label>
                <Input
                  type="number"
                  className="w-20 h-8 text-center"
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                  min={0}
                  max={100}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Quiz
              </Button>
            </div>
          </div>

          {questions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No questions yet. Click "Add Question" to create one.</p>
                <p className="text-sm mt-1">
                  Questions will appear during session quizzes. If no questions
                  are defined here, AI-generated quizzes will be used instead.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {questions.map((q, qi) => (
              <Card key={q.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Question {qi + 1}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(q.id)}
                      className="text-destructive hover:text-destructive"
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Question</Label>
                    <Input
                      value={q.question}
                      onChange={(e) =>
                        updateQuestion(q.id, "question", e.target.value)
                      }
                      placeholder="e.g., What does pinMode() do?"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Options</Label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuestion(q.id, "correct_index", oi)}
                          className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center border transition-colors ${
                            q.correct_index === oi
                              ? "bg-success text-success-foreground border-success"
                              : "bg-muted text-muted-foreground border-border hover:border-muted-foreground"
                          }`}
                          title={
                            q.correct_index === oi
                              ? "Correct answer"
                              : "Click to mark as correct"
                          }
                        >
                          {String.fromCharCode(65 + oi)}
                        </button>
                        <Input
                          value={opt}
                          onChange={(e) => updateOption(q.id, oi, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className={
                            q.correct_index === oi ? "border-success/50" : ""
                          }
                        />
                        {q.correct_index === oi && (
                          <span className="text-xs text-success font-medium w-16">
                            Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {questions.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} size="lg">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Quiz
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuizBuilder;
