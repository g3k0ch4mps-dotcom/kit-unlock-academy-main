 import { useState, useEffect } from "react";
 import { useParams, useNavigate } from "react-router-dom";
 import { Header } from "@/components/layout/Header";
 import { Footer } from "@/components/layout/Footer";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
 import { Label } from "@/components/ui/label";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import { 
   Clock, 
   CheckCircle2, 
   XCircle, 
   AlertTriangle,
   ArrowRight,
   ArrowLeft,
   Trophy,
   Loader2
 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { useToast } from "@/hooks/use-toast";
 
 interface Question {
   id: string;
   question: string;
   options: string[];
   correct_answer: number;
 }
 
 interface Test {
   id: string;
   title: string;
   description: string | null;
   passing_score: number;
   time_limit_mins: number | null;
   questions: Question[];
   program_id: string | null;
   kit_id: string | null;
 }
 
 const TestView = () => {
   const { testId } = useParams();
   const navigate = useNavigate();
   const { user } = useAuth();
   const { toast } = useToast();
   
   const [test, setTest] = useState<Test | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [currentQuestion, setCurrentQuestion] = useState(0);
   const [answers, setAnswers] = useState<Record<string, number>>({});
   const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [testResult, setTestResult] = useState<{
     score: number;
     passed: boolean;
     attemptId: string;
   } | null>(null);
   const [attemptId, setAttemptId] = useState<string | null>(null);
   
   useEffect(() => {
     if (testId) {
       fetchTest();
     }
   }, [testId]);
 
   useEffect(() => {
     // Timer countdown
     if (timeRemaining !== null && timeRemaining > 0 && !testResult) {
       const timer = setInterval(() => {
         setTimeRemaining(prev => {
           if (prev && prev <= 1) {
             handleSubmit();
             return 0;
           }
           return prev ? prev - 1 : null;
         });
       }, 1000);
       return () => clearInterval(timer);
     }
   }, [timeRemaining, testResult]);
 
   const fetchTest = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("program_tests")
       .select("*")
       .eq("id", testId).maybeSingle();
 
     if (error || !data) {
       toast({
         title: "Error",
         description: "Could not load test.",
         variant: "destructive"
       });
       navigate(-1);
       return;
     }
 
     // Parse questions from JSON
     const questions = Array.isArray(data.questions) 
       ? (data.questions as unknown as Question[])
       : [];
     
     setTest({ ...data, questions });
     
     // Set timer if time limit exists
     if (data.time_limit_mins) {
       setTimeRemaining(data.time_limit_mins * 60);
     }
 
     // Create test attempt
     if (user) {
       const { data: attempt } = await supabase
         .from("test_attempts")
         .insert({
           test_id: testId,
           user_id: user.id,
           started_at: new Date().toISOString()
         })
          .select()
          .maybeSingle();
        
        if (attempt) {
          setAttemptId(attempt.id);
       }
     }
     
     setIsLoading(false);
   };
 
   const formatTime = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, '0')}`;
   };
 
   const handleAnswer = (questionId: string, answerIndex: number) => {
     setAnswers(prev => ({
       ...prev,
       [questionId]: answerIndex
     }));
   };
 
   const handleNext = () => {
     if (test && currentQuestion < test.questions.length - 1) {
       setCurrentQuestion(prev => prev + 1);
     }
   };
 
   const handlePrevious = () => {
     if (currentQuestion > 0) {
       setCurrentQuestion(prev => prev - 1);
     }
   };
 
   const handleSubmit = async () => {
     if (!test || !user || !attemptId) return;
     
     setIsSubmitting(true);
 
     try {
       // Calculate score
       let correct = 0;
       test.questions.forEach(q => {
         if (answers[q.id] === q.correct_answer) {
           correct++;
         }
       });
       
       const score = Math.round((correct / test.questions.length) * 100);
       const passed = score >= test.passing_score;
 
       // Update test attempt
       await supabase
         .from("test_attempts")
         .update({
           answers: answers,
           score: score,
           passed: passed,
           completed_at: new Date().toISOString()
         })
         .eq("id", attemptId);
 
       setTestResult({ score, passed, attemptId });
 
       // If passed, generate certificate
       if (passed) {
         const { error } = await supabase.functions.invoke("generate-certificate", {
           body: {
             testAttemptId: attemptId,
             userId: user.id,
             programId: test.program_id,
             kitId: test.kit_id,
             score: score
           }
         });
 
         if (!error) {
           toast({
             title: "Certificate Generated!",
             description: "Your certificate is now available in your profile."
           });
         }
       }
     } catch (error) {
       console.error("Submit error:", error);
       toast({
         title: "Error",
         description: "Failed to submit test. Please try again.",
         variant: "destructive"
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   if (isLoading) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!test) {
     return (
       <div className="min-h-screen bg-background">
         <Header />
         <main className="container py-12 text-center">
           <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
           <h1 className="text-2xl font-bold mb-2">Test Not Found</h1>
           <p className="text-muted-foreground mb-4">The test you're looking for doesn't exist.</p>
           <Button onClick={() => navigate(-1)}>Go Back</Button>
         </main>
         <Footer />
       </div>
     );
   }
 
   // Show results if test is completed
   if (testResult) {
     return (
       <div className="min-h-screen bg-background">
         <Header />
         <main className="container py-12 max-w-2xl">
           <Card className="text-center">
             <CardHeader>
               {testResult.passed ? (
                 <>
                   <Trophy className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
                   <CardTitle className="text-2xl text-green-600">Congratulations!</CardTitle>
                   <CardDescription>You passed the test!</CardDescription>
                 </>
               ) : (
                 <>
                   <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
                   <CardTitle className="text-2xl text-destructive">Not Quite</CardTitle>
                   <CardDescription>You didn't pass this time.</CardDescription>
                 </>
               )}
             </CardHeader>
             <CardContent className="space-y-6">
               <div className="p-6 rounded-xl bg-muted/50">
                 <p className="text-4xl font-bold mb-2">{testResult.score}%</p>
                 <p className="text-sm text-muted-foreground">
                   Passing score: {test.passing_score}%
                 </p>
               </div>
               
               <div className="flex flex-col gap-3">
                 {testResult.passed ? (
                   <Button variant="hero" onClick={() => navigate("/profile")}>
                     View Certificate
                   </Button>
                 ) : (
                   <Button variant="hero" onClick={() => window.location.reload()}>
                     Try Again
                   </Button>
                 )}
                 <Button variant="outline" onClick={() => navigate("/programs")}>
                   Back to Programs
                 </Button>
               </div>
             </CardContent>
           </Card>
         </main>
         <Footer />
       </div>
     );
   }
 
   const currentQ = test.questions[currentQuestion];
   const progress = ((currentQuestion + 1) / test.questions.length) * 100;
   const answeredCount = Object.keys(answers).length;
 
   return (
     <div className="min-h-screen bg-background">
       <Header />
       
       <main className="container py-8 max-w-3xl">
         {/* Test Header */}
         <div className="mb-8">
           <h1 className="text-2xl font-bold mb-2">{test.title}</h1>
           {test.description && (
             <p className="text-muted-foreground">{test.description}</p>
           )}
         </div>
 
         {/* Progress & Timer Bar */}
         <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-card border border-border">
           <div className="flex items-center gap-4">
             <Badge variant="secondary">
               Question {currentQuestion + 1} of {test.questions.length}
             </Badge>
             <Badge variant="outline">
               {answeredCount} answered
             </Badge>
           </div>
           {timeRemaining !== null && (
             <div className={`flex items-center gap-2 ${timeRemaining < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
               <Clock className="h-4 w-4" />
               <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
             </div>
           )}
         </div>
 
         <Progress value={progress} className="mb-8" />
 
         {/* Question Card */}
         <Card className="mb-8">
           <CardHeader>
             <CardTitle className="text-lg">
               {currentQ?.question}
             </CardTitle>
           </CardHeader>
           <CardContent>
             <RadioGroup
               value={answers[currentQ?.id]?.toString()}
               onValueChange={(value) => handleAnswer(currentQ?.id, parseInt(value))}
               className="space-y-3"
             >
               {currentQ?.options?.map((option, index) => (
                 <div
                   key={index}
                   className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                     answers[currentQ?.id] === index 
                       ? 'border-primary bg-primary/5' 
                       : 'border-border hover:border-primary/50'
                   }`}
                   onClick={() => handleAnswer(currentQ?.id, index)}
                 >
                   <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                   <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                     {option}
                   </Label>
                 </div>
               ))}
             </RadioGroup>
           </CardContent>
         </Card>
 
         {/* Navigation */}
         <div className="flex items-center justify-between">
           <Button
             variant="outline"
             onClick={handlePrevious}
             disabled={currentQuestion === 0}
           >
             <ArrowLeft className="h-4 w-4 mr-2" />
             Previous
           </Button>
 
           <div className="flex gap-3">
             {currentQuestion === test.questions.length - 1 ? (
               <Button
                 variant="hero"
                 onClick={handleSubmit}
                 disabled={isSubmitting || answeredCount < test.questions.length}
               >
                 {isSubmitting ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Submitting...
                   </>
                 ) : (
                   <>
                     <CheckCircle2 className="h-4 w-4 mr-2" />
                     Submit Test
                   </>
                 )}
               </Button>
             ) : (
               <Button
                 variant="hero"
                 onClick={handleNext}
               >
                 Next
                 <ArrowRight className="h-4 w-4 ml-2" />
               </Button>
             )}
           </div>
         </div>
 
         {/* Question Navigator */}
         <div className="mt-8 p-4 rounded-xl bg-card border border-border">
           <p className="text-sm font-medium mb-3">Quick Navigation</p>
           <div className="flex flex-wrap gap-2">
             {test.questions.map((q, index) => (
               <button
                 key={q.id}
                 onClick={() => setCurrentQuestion(index)}
                 className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                   currentQuestion === index
                     ? 'bg-primary text-primary-foreground'
                     : answers[q.id] !== undefined
                   ? 'bg-accent/50 text-accent-foreground border border-accent'
                     : 'bg-muted hover:bg-muted/80'
                 }`}
               >
                 {index + 1}
               </button>
             ))}
           </div>
         </div>
       </main>
 
       <Footer />
     </div>
   );
 };
 
 export default TestView;

