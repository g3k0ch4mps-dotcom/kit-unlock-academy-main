 import { useState, useEffect } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Plus, Pencil, Trash2, ClipboardCheck, Loader2, X } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Badge } from "@/components/ui/badge";
 
 interface Question {
   id: string;
   question: string;
   options: string[];
   correctAnswer: number;
 }
 
 interface Test {
   id: string;
   title: string;
   description: string | null;
   program_id: string | null;
   kit_id: string | null;
   questions: Question[];
   passing_score: number;
   time_limit_mins: number;
 }
 
 type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
 
 interface Program {
   id: string;
   title: string;
 }
 
 interface Kit {
   id: string;
   name: string;
 }
 
 export const TestManager = () => {
   const [tests, setTests] = useState<Test[]>([]);
   const [programs, setPrograms] = useState<Program[]>([]);
   const [kits, setKits] = useState<Kit[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
   const [editingTest, setEditingTest] = useState<Test | null>(null);
   const [formData, setFormData] = useState({
     title: "",
     description: "",
     program_id: "",
     kit_id: "",
     passing_score: 70,
     time_limit_mins: 30,
     questions: [] as Question[],
   });
   const [newQuestion, setNewQuestion] = useState({
     question: "",
     options: ["", "", "", ""],
     correctAnswer: 0,
   });
   const { toast } = useToast();
 
   useEffect(() => {
     fetchTests();
     fetchPrograms();
     fetchKits();
   }, []);
 
   const fetchTests = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("program_tests")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (error) {
       toast({ title: "Error", description: "Failed to load tests.", variant: "destructive" });
     } else {
       setTests((data || []).map(t => ({
         ...t,
         questions: Array.isArray(t.questions) ? (t.questions as unknown as Question[]) : []
       })) as Test[]);
     }
     setIsLoading(false);
   };
 
   const fetchPrograms = async () => {
     const { data } = await supabase.from("programs").select("id, title").order("title");
     if (data) setPrograms(data);
   };
 
   const fetchKits = async () => {
     const { data } = await supabase.from("kits").select("id, name").order("name");
     if (data) setKits(data);
   };
 
   const resetForm = () => {
     setFormData({
       title: "",
       description: "",
       program_id: "",
       kit_id: "",
       passing_score: 70,
       time_limit_mins: 30,
       questions: [],
     });
     setNewQuestion({ question: "", options: ["", "", "", ""], correctAnswer: 0 });
     setEditingTest(null);
   };
 
   const handleOpenDialog = (test?: Test) => {
     if (test) {
       setEditingTest(test);
       setFormData({
         title: test.title,
         description: test.description || "",
         program_id: test.program_id || "",
         kit_id: test.kit_id || "",
         passing_score: test.passing_score,
         time_limit_mins: test.time_limit_mins || 30,
         questions: test.questions || [],
       });
     } else {
       resetForm();
     }
     setIsDialogOpen(true);
   };
 
   const addQuestion = () => {
     if (!newQuestion.question.trim() || newQuestion.options.some(o => !o.trim())) {
       toast({ title: "Error", description: "Please fill all question fields.", variant: "destructive" });
       return;
     }
     setFormData({
       ...formData,
       questions: [
         ...formData.questions,
         { ...newQuestion, id: crypto.randomUUID() }
       ],
     });
     setNewQuestion({ question: "", options: ["", "", "", ""], correctAnswer: 0 });
   };
 
   const removeQuestion = (id: string) => {
     setFormData({
       ...formData,
       questions: formData.questions.filter(q => q.id !== id),
     });
   };
 
   const handleSave = async () => {
     if (!formData.program_id && !formData.kit_id) {
       toast({ title: "Error", description: "Please select a program or kit.", variant: "destructive" });
       return;
     }
 
     const payload = {
       title: formData.title,
       description: formData.description || null,
       program_id: formData.program_id || null,
       kit_id: formData.kit_id || null,
       passing_score: formData.passing_score,
       time_limit_mins: formData.time_limit_mins,
       questions: formData.questions as unknown as Json,
     };
 
     if (editingTest) {
       const { error } = await supabase
         .from("program_tests")
         .update(payload)
         .eq("id", editingTest.id);
 
       if (error) {
         toast({ title: "Error", description: "Failed to update test.", variant: "destructive" });
       } else {
         toast({ title: "Test Updated", description: "The test has been updated." });
         fetchTests();
       }
     } else {
       const { error } = await supabase.from("program_tests").insert(payload);
 
       if (error) {
         toast({ title: "Error", description: "Failed to create test.", variant: "destructive" });
       } else {
         toast({ title: "Test Created", description: "New test has been added." });
         fetchTests();
       }
     }
 
     setIsDialogOpen(false);
     resetForm();
   };
 
   const handleDelete = async () => {
     if (!editingTest) return;
 
     const { error } = await supabase.from("program_tests").delete().eq("id", editingTest.id);
 
     if (error) {
       toast({ title: "Error", description: "Failed to delete test.", variant: "destructive" });
     } else {
       toast({ title: "Test Deleted", description: "The test has been removed." });
       fetchTests();
     }
 
     setIsDeleteDialogOpen(false);
     setEditingTest(null);
   };
 
   const getLinkedName = (test: Test) => {
     if (test.program_id) {
       return programs.find(p => p.id === test.program_id)?.title || "Unknown Program";
     }
     if (test.kit_id) {
       return kits.find(k => k.id === test.kit_id)?.name || "Unknown Kit";
     }
     return "No link";
   };
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
             <ClipboardCheck className="h-5 w-5 text-warning" />
           </div>
           <div>
             <h2 className="text-xl font-bold">Test Management</h2>
             <p className="text-sm text-muted-foreground">Create tests for programs and kits</p>
           </div>
         </div>
         <Button variant="hero" onClick={() => handleOpenDialog()}>
           <Plus className="mr-2 h-4 w-4" />
           Add Test
         </Button>
       </div>
 
       {isLoading ? (
         <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       ) : tests.length === 0 ? (
         <div className="text-center py-12 rounded-xl bg-card border border-border">
           <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
           <p className="text-muted-foreground">No tests found. Create your first test!</p>
         </div>
       ) : (
         <div className="grid gap-4">
           {tests.map((test) => (
             <div
               key={test.id}
               className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
             >
               <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                 <ClipboardCheck className="h-6 w-6 text-warning" />
               </div>
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1">
                   <h3 className="font-semibold truncate">{test.title}</h3>
                   <Badge variant="outline">{test.questions.length} questions</Badge>
                 </div>
                 <p className="text-sm text-muted-foreground">
                   Linked to: {getLinkedName(test)} • Pass: {test.passing_score}% • {test.time_limit_mins} mins
                 </p>
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(test)}>
                   <Pencil className="h-4 w-4" />
                 </Button>
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={() => {
                     setEditingTest(test);
                     setIsDeleteDialogOpen(true);
                   }}
                 >
                   <Trash2 className="h-4 w-4 text-destructive" />
                 </Button>
               </div>
             </div>
           ))}
         </div>
       )}
 
       {/* Add/Edit Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>{editingTest ? "Edit Test" : "Add New Test"}</DialogTitle>
             <DialogDescription>
               {editingTest ? "Update the test details and questions." : "Create a new assessment test."}
             </DialogDescription>
           </DialogHeader>
           <div className="grid gap-4 py-4">
             <div className="grid gap-2">
               <Label>Test Title</Label>
               <Input
                 value={formData.title}
                 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                 placeholder="Enter test title"
               />
             </div>
             <div className="grid gap-2">
               <Label>Description</Label>
               <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Brief description"
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label>Link to Program</Label>
                 <Select
                   value={formData.program_id}
                   onValueChange={(value) => setFormData({ ...formData, program_id: value, kit_id: "" })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select program" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">None</SelectItem>
                     {programs.map((p) => (
                       <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="grid gap-2">
                 <Label>Or Link to Kit</Label>
                 <Select
                   value={formData.kit_id}
                   onValueChange={(value) => setFormData({ ...formData, kit_id: value, program_id: "" })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Select kit" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">None</SelectItem>
                     {kits.map((k) => (
                       <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label>Passing Score (%)</Label>
                 <Input
                   type="number"
                   value={formData.passing_score}
                   onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 70 })}
                   min={1}
                   max={100}
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Time Limit (mins)</Label>
                 <Input
                   type="number"
                   value={formData.time_limit_mins}
                   onChange={(e) => setFormData({ ...formData, time_limit_mins: parseInt(e.target.value) || 30 })}
                   min={1}
                 />
               </div>
             </div>
 
             {/* Questions */}
             <div className="border-t pt-4 mt-2">
               <h4 className="font-semibold mb-3">Questions ({formData.questions.length})</h4>
               {formData.questions.map((q, idx) => (
                 <div key={q.id} className="p-3 rounded-lg bg-muted/50 mb-2 relative">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="absolute top-2 right-2 h-6 w-6"
                     onClick={() => removeQuestion(q.id)}
                   >
                     <X className="h-4 w-4" />
                   </Button>
                   <p className="text-sm font-medium mb-1">Q{idx + 1}: {q.question}</p>
                   <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                     {q.options.map((opt, i) => (
                       <span key={i} className={i === q.correctAnswer ? "text-success font-medium" : ""}>
                         {String.fromCharCode(65 + i)}) {opt}
                       </span>
                     ))}
                   </div>
                 </div>
               ))}
 
               {/* Add Question Form */}
               <div className="p-4 rounded-lg border border-dashed border-border space-y-3">
                 <Label>Add New Question</Label>
                 <Input
                   value={newQuestion.question}
                   onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                   placeholder="Enter question"
                 />
                 <div className="grid grid-cols-2 gap-2">
                   {newQuestion.options.map((opt, i) => (
                     <Input
                       key={i}
                       value={opt}
                       onChange={(e) => {
                         const opts = [...newQuestion.options];
                         opts[i] = e.target.value;
                         setNewQuestion({ ...newQuestion, options: opts });
                       }}
                       placeholder={`Option ${String.fromCharCode(65 + i)}`}
                     />
                   ))}
                 </div>
                 <div className="flex items-center gap-4">
                   <Label>Correct Answer:</Label>
                   <Select
                     value={String(newQuestion.correctAnswer)}
                     onValueChange={(v) => setNewQuestion({ ...newQuestion, correctAnswer: parseInt(v) })}
                   >
                     <SelectTrigger className="w-24">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="0">A</SelectItem>
                       <SelectItem value="1">B</SelectItem>
                       <SelectItem value="2">C</SelectItem>
                       <SelectItem value="3">D</SelectItem>
                     </SelectContent>
                   </Select>
                   <Button variant="outline" size="sm" onClick={addQuestion}>
                     <Plus className="h-4 w-4 mr-1" />
                     Add
                   </Button>
                 </div>
               </div>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="hero" onClick={handleSave} disabled={!formData.title || formData.questions.length === 0}>
               {editingTest ? "Save Changes" : "Add Test"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Delete Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent className="sm:max-w-[400px]">
           <DialogHeader>
             <DialogTitle>Delete Test</DialogTitle>
             <DialogDescription>
               Are you sure you want to delete "{editingTest?.title}"? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="destructive" onClick={handleDelete}>
               Delete Test
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default TestManager;