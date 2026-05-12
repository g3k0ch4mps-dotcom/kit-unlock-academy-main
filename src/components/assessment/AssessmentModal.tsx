import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, CheckCircle2, ArrowRight, HelpCircle } from "lucide-react";

interface AssessmentQuestion {
  question: string;
  options: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  correct_index: number;
}

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programTitle: string;
  programCategory?: string | null;
  onComplete: (skillLevel: string) => void;
}

export const AssessmentModal = ({
  isOpen,
  onClose,
  programId,
  programTitle,
  programCategory,
  onComplete,
}: AssessmentModalProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<"intro" | "questions" | "result">("intro");
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ difficulty: string; correct: boolean }[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultLevel, setResultLevel] = useState("");

  const startAssessment = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("personalize-content", {
        body: {
          action: "generate_questions",
          programTitle,
          programCategory,
        },
      });

      if (error) throw error;
      if (data.questions && data.questions.length > 0) {
        // Trim options to 3 per question and add "I don't know"
        const trimmedQuestions = data.questions.map((q: AssessmentQuestion) => {
          // Keep only 2 real options (including the correct one) + "I don't know"
          const correctOption = q.options[q.correct_index];
          const otherOptions = q.options.filter((_: string, i: number) => i !== q.correct_index);
          const selectedOther = otherOptions.slice(0, 1); // 1 wrong option
          
          // Build final options: correct + 1 wrong + "I don't know"
          const finalOptions = [correctOption, ...selectedOther, "I don't know"];
          
          // Shuffle the first two options (not "I don't know" which stays last)
          const shuffleable = finalOptions.slice(0, 2);
          for (let i = shuffleable.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffleable[i], shuffleable[j]] = [shuffleable[j], shuffleable[i]];
          }
          
          const newOptions = [...shuffleable, "I don't know"];
          const newCorrectIndex = newOptions.indexOf(correctOption);
          
          return {
            ...q,
            options: newOptions,
            correct_index: newCorrectIndex,
          };
        });
        
        setQuestions(trimmedQuestions);
        setStep("questions");
        setCurrentQ(0);
        setAnswers([]);
      } else {
        throw new Error("No questions generated");
      }
    } catch (err) {
      toast({ title: "Error", description: "Could not generate assessment questions. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const answerQuestion = async () => {
    if (selectedOption === null) return;

    const q = questions[currentQ];
    const isCorrect = selectedOption === q.correct_index;
    const newAnswers = [...answers, { difficulty: q.difficulty, correct: isCorrect }];
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      // Submit assessment
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("personalize-content", {
          body: {
            action: "submit_assessment",
            programId,
            answers: newAnswers,
          },
        });

        if (error) throw error;
        setResultLevel(data.skillLevel);
        setStep("result");
      } catch (err) {
        toast({ title: "Error", description: "Could not submit assessment.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const finishAssessment = () => {
    onComplete(resultLevel);
    onClose();
    // Reset state
    setStep("intro");
    setQuestions([]);
    setCurrentQ(0);
    setAnswers([]);
    setResultLevel("");
  };

  const difficultyColor = (d: string) => {
    if (d === "beginner") return "bg-success/10 text-success";
    if (d === "intermediate") return "bg-warning/10 text-warning";
    return "bg-destructive/10 text-destructive";
  };

  const levelEmoji: Record<string, string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { if (!isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {step === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Skill Assessment
              </DialogTitle>
              <DialogDescription>
                Before starting "{programTitle}", let us understand your current level so we can personalize the content for you.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <p className="font-medium text-foreground">Why this assessment?</p>
                </div>
                <p className="text-foreground leading-relaxed">
                  This short test helps us understand your current knowledge level so we can customize the learning content specifically for you. You will receive content that matches your experience - whether you are a complete beginner or more advanced.
                </p>
                <ul className="space-y-1 ml-4 list-disc text-foreground mt-2">
                  <li>5 quick questions about the topic</li>
                  <li>Determines your experience level</li>
                  <li>Content will be customized to match your level</li>
                  <li>Select "I don't know" if unsure - that is perfectly okay</li>
                </ul>
              </div>
              <Button onClick={startAssessment} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing Questions...
                  </>
                ) : (
                  <>
                    Start Assessment
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={finishAssessment} className="w-full text-muted-foreground">
                Skip (default to beginner)
              </Button>
            </div>
          </>
        )}

        {step === "questions" && questions[currentQ] && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Question {currentQ + 1} of {questions.length}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />
              <Badge variant="outline" className={difficultyColor(questions[currentQ].difficulty)}>
                {questions[currentQ].difficulty}
              </Badge>
              <p className="font-medium text-sm leading-relaxed text-foreground">{questions[currentQ].question}</p>
              <div className="space-y-2">
                {questions[currentQ].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(i)}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                      selectedOption === i
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    } ${opt === "I don't know" ? "italic text-muted-foreground" : "text-foreground"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <Button
                onClick={answerQuestion}
                disabled={selectedOption === null || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentQ < questions.length - 1 ? (
                  "Next Question"
                ) : (
                  "Submit Assessment"
                )}
              </Button>
            </div>
          </>
        )}

        {step === "result" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Assessment Complete
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-center">
              <div className="bg-primary/5 rounded-xl p-6">
                <p className="text-sm text-muted-foreground mb-2">Your Level</p>
                <p className="text-2xl font-bold text-primary capitalize">{levelEmoji[resultLevel] || resultLevel}</p>
              </div>
              <p className="text-sm text-foreground">
                Session content will be adapted to match your {resultLevel} level with
                {resultLevel === "beginner" && " simpler language and more detailed explanations."}
                {resultLevel === "intermediate" && " moderate technical language and practical focus."}
                {resultLevel === "advanced" && " deeper technical insights and advanced concepts."}
              </p>
              <Button onClick={finishAssessment} className="w-full">
                Start Learning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
