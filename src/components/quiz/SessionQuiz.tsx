import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Brain,
} from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

interface QuizResult {
  questions: QuizQuestion[];
  answers: Record<string, number>;
  score: number;
  totalQuestions: number;
}

interface SessionQuizProps {
  sessionId: string;
  programId: string;
  sessionTitle: string;
  onClose: () => void;
  onComplete: (score: number) => void;
}

export const SessionQuiz = ({
  sessionId,
  programId,
  sessionTitle,
  onClose,
  onComplete,
}: SessionQuizProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"loading" | "quiz" | "results">("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previousAttempt, setPreviousAttempt] = useState<QuizResult | null>(null);
  const [quizSource, setQuizSource] = useState<"predefined" | "ai">("ai");

  useEffect(() => {
    checkPreviousAttempt();
  }, []);

  const checkPreviousAttempt = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("session_quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const attempt = data[0];
      const prev: QuizResult = {
        questions: attempt.questions as unknown as QuizQuestion[],
        answers: attempt.answers as unknown as Record<string, number>,
        score: attempt.score,
        totalQuestions: attempt.total_questions,
      };
      setPreviousAttempt(prev);
      setResult(prev);
      setStep("results");
    } else {
      loadQuiz();
    }
  };

  const loadQuiz = async () => {
    setStep("loading");
    // Try loading predefined quiz from session_quizzes first
    const { data: predefined } = await supabase
      .from("session_quizzes")
      .select("questions")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (predefined && predefined.questions && Array.isArray(predefined.questions) && predefined.questions.length > 0) {
      setQuestions(predefined.questions as QuizQuestion[]);
      setQuizSource("predefined");
      setCurrentQ(0);
      setAnswers({});
      setStep("quiz");
      return;
    }

    // Fallback to AI generation
    await generateQuiz();
  };

  const generateQuiz = async () => {
    setStep("loading");
    try {
      // Generate from the session's own content via Gemini (same provider as the
      // AI chat). This also persists the quiz to session_quizzes, so the next
      // load is served instantly from the predefined path above.
      const { data, error } = await supabase.functions.invoke("generate-quiz-questions", {
        body: { sessionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setQuizSource("ai");
        setCurrentQ(0);
        setAnswers({});
        setStep("quiz");
      } else {
        throw new Error("No questions generated");
      }
    } catch (err) {
      console.error("Quiz generation failed:", err);
      // supabase-js wraps non-2xx responses in a FunctionsHttpError whose real
      // body lives on .context — pull the actual message out when present.
      let description = err instanceof Error ? err.message : "Please try again.";
      if (err && typeof err === "object" && "context" in err) {
        try {
          const body = await (err as { context: Response }).context.json();
          if (body?.error) description = body.error;
        } catch {
          /* keep the fallback message */
        }
      }
      toast({ title: "Could not generate quiz", description, variant: "destructive" });
      onClose();
    }
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct_index) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);

    try {
      await supabase.from("session_quiz_attempts").insert({
        user_id: user.id,
        session_id: sessionId,
        program_id: programId,
        questions: questions as unknown as any,
        answers: answers as unknown as any,
        score,
        total_questions: questions.length,
        passed: score >= 50,
        completed_at: new Date().toISOString(),
      });

      const res: QuizResult = {
        questions,
        answers,
        score,
        totalQuestions: questions.length,
      };
      setResult(res);
      setStep("results");
      onComplete(score);
    } catch {
      toast({ title: "Error", description: "Failed to save quiz results.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedo = () => {
    setResult(null);
    setPreviousAttempt(null);
    loadQuiz();
  };

  if (step === "loading") {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Card className="text-center p-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Generating quiz based on session content...</p>
        </Card>
      </div>
    );
  }

  if (step === "results" && result) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        {/* Score Summary */}
        <Card>
          <CardHeader className="text-center pb-2">
            {result.score >= 80 ? (
              <Trophy className="h-12 w-12 mx-auto mb-2 text-yellow-500" />
            ) : result.score >= 50 ? (
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
            ) : (
              <XCircle className="h-12 w-12 mx-auto mb-2 text-destructive" />
            )}
            <CardTitle className="text-2xl">
              {result.score >= 80 ? "Excellent!" : result.score >= 50 ? "Good Job!" : "Keep Practicing"}
            </CardTitle>
            <p className="text-muted-foreground text-sm">{sessionTitle}</p>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-muted">
              <span className="text-3xl font-bold">{result.score}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {Object.values(result.answers).filter((a, i) => a === result.questions[i]?.correct_index).length} of {result.totalQuestions} correct
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleRedo}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Redo Quiz
              </Button>
              <Button onClick={onClose}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Review Answers</h3>
          {result.questions.map((q, qi) => {
            const userAnswer = result.answers[q.id];
            const isCorrect = userAnswer === q.correct_index;
            return (
              <Card key={q.id} className={`border-l-4 ${isCorrect ? "border-l-success" : "border-l-destructive"}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3 mb-3">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-2">
                        Q{qi + 1}: {q.question}
                      </p>
                      <div className="space-y-1">
                        {q.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`text-sm px-3 py-2 rounded-md ${
                              oi === q.correct_index
                                ? "bg-success/10 text-success font-medium"
                                : oi === userAnswer && !isCorrect
                                ? "bg-destructive/10 text-destructive line-through"
                                : "text-muted-foreground"
                            }`}
                          >
                            {opt}
                            {oi === q.correct_index && " ✓"}
                            {oi === userAnswer && !isCorrect && " (your answer)"}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Quiz step
  const currentQuestion = questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const progress = ((currentQ + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Session Quiz
          </h2>
          <p className="text-sm text-muted-foreground">{sessionTitle}</p>
        </div>
        <Badge variant="secondary">
          {answeredCount}/{questions.length} answered
        </Badge>
      </div>

      <Progress value={progress} className="h-2" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline">Question {currentQ + 1} of {questions.length}</Badge>
          </div>
          <CardTitle className="text-lg mt-2">{currentQuestion?.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {currentQuestion?.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(currentQuestion.id, i)}
              className={`w-full text-left p-4 rounded-lg border text-sm transition-colors ${
                answers[currentQuestion.id] === i
                  ? "border-primary bg-primary/5 font-medium"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              {opt}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentQ((p) => p - 1)} disabled={currentQ === 0}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <div className="flex gap-3">
          {currentQ === questions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || answeredCount < questions.length}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={() => setCurrentQ((p) => p + 1)}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentQ(i)}
            className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
              currentQ === i
                ? "bg-primary text-primary-foreground"
                : answers[q.id] !== undefined
                ? "bg-accent/50 text-accent-foreground border border-accent"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
};
