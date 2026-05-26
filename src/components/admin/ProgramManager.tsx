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
 import { Plus, Pencil, Trash2, BookOpen, Loader2 } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Badge } from "@/components/ui/badge";
 
 interface Program {
   id: string;
   title: string;
   description: string | null;
   difficulty_level: "beginner" | "intermediate" | "advanced";
   category: "robotics" | "iot" | "electronics" | "ai_ml" | "sensors" | "automation";
   image_url: string | null;
   total_sessions: number;
   estimated_hours: number;
   kit_id: string | null;
 }
 
 interface Kit {
   id: string;
   name: string;
 }
 
 const DIFFICULTY_LEVELS = [
   { value: "beginner", label: "Beginner" },
   { value: "intermediate", label: "Intermediate" },
   { value: "advanced", label: "Advanced" },
 ];
 
 const CATEGORIES = [
   { value: "robotics", label: "Robotics" },
   { value: "iot", label: "IoT" },
   { value: "electronics", label: "Electronics" },
   { value: "ai_ml", label: "AI/Machine Learning" },
   { value: "sensors", label: "Sensors" },
   { value: "automation", label: "Automation" },
 ];
 
 export const ProgramManager = () => {
   const [programs, setPrograms] = useState<Program[]>([]);
   const [kits, setKits] = useState<Kit[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
   const [editingProgram, setEditingProgram] = useState<Program | null>(null);
   const [formData, setFormData] = useState({
     title: "",
     description: "",
     difficulty_level: "beginner" as Program["difficulty_level"],
     category: "robotics" as Program["category"],
     image_url: "",
     total_sessions: 10,
     estimated_hours: 10,
     kit_id: "",
   });
   const { toast } = useToast();
 
   useEffect(() => {
     fetchPrograms();
     fetchKits();
   }, []);
 
   const fetchPrograms = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("programs")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (error) {
       toast({ title: "Error", description: "Failed to load programs.", variant: "destructive" });
     } else {
       setPrograms((data || []) as Program[]);
     }
     setIsLoading(false);
   };
 
   const fetchKits = async () => {
     const { data } = await supabase.from("kits").select("id, name").order("name");
     if (data) setKits(data);
   };
 
   const resetForm = () => {
     setFormData({
       title: "",
       description: "",
       difficulty_level: "beginner",
       category: "robotics",
       image_url: "",
       total_sessions: 10,
       estimated_hours: 10,
       kit_id: "",
     });
     setEditingProgram(null);
   };
 
   const handleOpenDialog = (program?: Program) => {
     if (program) {
       setEditingProgram(program);
       setFormData({
         title: program.title,
         description: program.description || "",
         difficulty_level: program.difficulty_level,
         category: program.category,
         image_url: program.image_url || "",
         total_sessions: program.total_sessions || 10,
         estimated_hours: program.estimated_hours || 10,
         kit_id: program.kit_id || "",
       });
     } else {
       resetForm();
     }
     setIsDialogOpen(true);
   };
 
   const handleSave = async () => {
     const payload = {
       title: formData.title,
       description: formData.description || null,
       difficulty_level: formData.difficulty_level,
       category: formData.category,
       image_url: formData.image_url || null,
       total_sessions: formData.total_sessions,
       estimated_hours: formData.estimated_hours,
       kit_id: formData.kit_id || null,
     };
 
     if (editingProgram) {
       const { error } = await supabase
         .from("programs")
         .update(payload)
         .eq("id", editingProgram.id);
 
       if (error) {
         toast({ title: "Error", description: "Failed to update program.", variant: "destructive" });
       } else {
         toast({ title: "Program Updated", description: "The program has been updated." });
         fetchPrograms();
       }
     } else {
       const { error } = await supabase.from("programs").insert(payload);
 
       if (error) {
         toast({ title: "Error", description: "Failed to create program.", variant: "destructive" });
       } else {
         toast({ title: "Program Created", description: "New program has been added." });
         fetchPrograms();
       }
     }
 
     setIsDialogOpen(false);
     resetForm();
   };
 
   const handleDelete = async () => {
     if (!editingProgram) return;
 
     const { error } = await supabase.from("programs").delete().eq("id", editingProgram.id);
 
     if (error) {
       toast({ title: "Error", description: "Failed to delete program.", variant: "destructive" });
     } else {
       toast({ title: "Program Deleted", description: "The program has been removed." });
       fetchPrograms();
     }
 
     setIsDeleteDialogOpen(false);
     setEditingProgram(null);
   };
 
   const getDifficultyColor = (level: string) => {
     switch (level) {
       case "beginner": return "bg-success/10 text-success";
       case "intermediate": return "bg-warning/10 text-warning";
       case "advanced": return "bg-destructive/10 text-destructive";
       default: return "bg-muted text-muted-foreground";
     }
   };
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
             <BookOpen className="h-5 w-5 text-primary" />
           </div>
           <div>
             <h2 className="text-xl font-bold">Program Management</h2>
             <p className="text-sm text-muted-foreground">Create and manage learning programs</p>
           </div>
         </div>
         <Button variant="hero" onClick={() => handleOpenDialog()}>
           <Plus className="mr-2 h-4 w-4" />
           Add Program
         </Button>
       </div>
 
       {isLoading ? (
         <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       ) : programs.length === 0 ? (
         <div className="text-center py-12 rounded-xl bg-card border border-border">
           <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
           <p className="text-muted-foreground">No programs found. Create your first program!</p>
         </div>
       ) : (
         <div className="grid gap-4">
           {programs.map((program) => (
             <div
               key={program.id}
               className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
             >
               <div className="w-20 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                 {program.image_url ? (
                   <img src={program.image_url} alt={program.title} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center">
                     <BookOpen className="h-6 w-6 text-muted-foreground" />
                   </div>
                 )}
               </div>
               <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-1">
                   <h3 className="font-semibold truncate">{program.title}</h3>
                   <Badge className={getDifficultyColor(program.difficulty_level)}>
                     {program.difficulty_level}
                   </Badge>
                   <Badge variant="outline">{program.category}</Badge>
                 </div>
                 <p className="text-sm text-muted-foreground line-clamp-1">{program.description}</p>
                 <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                   <span>{program.total_sessions} sessions</span>
                   <span>{program.estimated_hours} hours</span>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(program)} aria-label="Edit program">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingProgram(program);
                      setIsDeleteDialogOpen(true);
                    }}
                    aria-label="Delete program"
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
         <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>{editingProgram ? "Edit Program" : "Add New Program"}</DialogTitle>
             <DialogDescription>
               {editingProgram ? "Update the program details." : "Create a new learning program."}
             </DialogDescription>
           </DialogHeader>
           <div className="grid gap-4 py-4">
             <div className="grid gap-2">
               <Label>Program Title</Label>
               <Input
                 value={formData.title}
                 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                 placeholder="Enter program title"
               />
             </div>
             <div className="grid gap-2">
               <Label>Description</Label>
               <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Brief description of the program"
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label>Difficulty Level</Label>
                 <Select
                   value={formData.difficulty_level}
                   onValueChange={(value: Program["difficulty_level"]) =>
                     setFormData({ ...formData, difficulty_level: value })
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {DIFFICULTY_LEVELS.map((level) => (
                       <SelectItem key={level.value} value={level.value}>
                         {level.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="grid gap-2">
                 <Label>Category</Label>
                 <Select
                   value={formData.category}
                   onValueChange={(value: Program["category"]) =>
                     setFormData({ ...formData, category: value })
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {CATEGORIES.map((cat) => (
                       <SelectItem key={cat.value} value={cat.value}>
                         {cat.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label>Total Sessions</Label>
                 <Input
                   type="number"
                   value={formData.total_sessions}
                   onChange={(e) => setFormData({ ...formData, total_sessions: parseInt(e.target.value) || 0 })}
                   min={1}
                 />
               </div>
               <div className="grid gap-2">
                 <Label>Estimated Hours</Label>
                 <Input
                   type="number"
                   value={formData.estimated_hours}
                   onChange={(e) => setFormData({ ...formData, estimated_hours: parseInt(e.target.value) || 0 })}
                   min={1}
                 />
               </div>
             </div>
              <div className="grid gap-2">
                <Label>Link to Kit (Optional)</Label>
                <Select
                  value={formData.kit_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, kit_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a kit (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No kit linked</SelectItem>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={kit.id}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
             <div className="grid gap-2">
               <Label>Image URL</Label>
               <Input
                 value={formData.image_url}
                 onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                 placeholder="https://..."
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="hero" onClick={handleSave} disabled={!formData.title}>
               {editingProgram ? "Save Changes" : "Add Program"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Delete Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent className="sm:max-w-[400px]">
           <DialogHeader>
             <DialogTitle>Delete Program</DialogTitle>
             <DialogDescription>
               Are you sure you want to delete "{editingProgram?.title}"? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="destructive" onClick={handleDelete}>
               Delete Program
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default ProgramManager;