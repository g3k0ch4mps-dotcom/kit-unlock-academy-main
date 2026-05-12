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
 import { Plus, Pencil, Trash2, FolderOpen, Loader2, ExternalLink } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 import { Badge } from "@/components/ui/badge";
 
 interface Project {
   id: string;
   name: string;
   description: string | null;
   difficulty_level: "beginner" | "intermediate" | "advanced";
   category: "robotics" | "iot" | "electronics" | "ai_ml" | "sensors" | "automation";
   image_url: string | null;
   components: string[];
   circuit_diagram_url: string | null;
   code: string | null;
   code_language: string;
   simulation_url: string | null;
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
 
 export const ProjectManager = () => {
   const [projects, setProjects] = useState<Project[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
   const [editingProject, setEditingProject] = useState<Project | null>(null);
   const [formData, setFormData] = useState({
     name: "",
     description: "",
     difficulty_level: "beginner" as Project["difficulty_level"],
     category: "robotics" as Project["category"],
     image_url: "",
     components: "",
     circuit_diagram_url: "",
     code: "",
     code_language: "cpp",
     simulation_url: "",
   });
   const { toast } = useToast();
 
   useEffect(() => {
     fetchProjects();
   }, []);
 
   const fetchProjects = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("projects")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (error) {
       toast({ title: "Error", description: "Failed to load projects.", variant: "destructive" });
     } else {
       setProjects((data || []).map(p => ({
         ...p,
         components: Array.isArray(p.components) ? p.components : []
       })) as Project[]);
     }
     setIsLoading(false);
   };
 
   const resetForm = () => {
     setFormData({
       name: "",
       description: "",
       difficulty_level: "beginner",
       category: "robotics",
       image_url: "",
       components: "",
       circuit_diagram_url: "",
       code: "",
       code_language: "cpp",
       simulation_url: "",
     });
     setEditingProject(null);
   };
 
   const handleOpenDialog = (project?: Project) => {
     if (project) {
       setEditingProject(project);
       setFormData({
         name: project.name,
         description: project.description || "",
         difficulty_level: project.difficulty_level,
         category: project.category,
         image_url: project.image_url || "",
         components: project.components.join(", "),
         circuit_diagram_url: project.circuit_diagram_url || "",
         code: project.code || "",
         code_language: project.code_language || "cpp",
         simulation_url: project.simulation_url || "",
       });
     } else {
       resetForm();
     }
     setIsDialogOpen(true);
   };
 
   const handleSave = async () => {
     const componentsArray = formData.components
       .split(",")
       .map(c => c.trim())
       .filter(c => c.length > 0);
 
     const payload = {
       name: formData.name,
       description: formData.description || null,
       difficulty_level: formData.difficulty_level,
       category: formData.category,
       image_url: formData.image_url || null,
       components: componentsArray,
       circuit_diagram_url: formData.circuit_diagram_url || null,
       code: formData.code || null,
       code_language: formData.code_language,
       simulation_url: formData.simulation_url || null,
     };
 
     if (editingProject) {
       const { error } = await supabase
         .from("projects")
         .update(payload)
         .eq("id", editingProject.id);
 
       if (error) {
         toast({ title: "Error", description: "Failed to update project.", variant: "destructive" });
       } else {
         toast({ title: "Project Updated", description: "The project has been updated." });
         fetchProjects();
       }
     } else {
       const { error } = await supabase.from("projects").insert(payload);
 
       if (error) {
         toast({ title: "Error", description: "Failed to create project.", variant: "destructive" });
       } else {
         toast({ title: "Project Created", description: "New project has been added." });
         fetchProjects();
       }
     }
 
     setIsDialogOpen(false);
     resetForm();
   };
 
   const handleDelete = async () => {
     if (!editingProject) return;
 
     const { error } = await supabase.from("projects").delete().eq("id", editingProject.id);
 
     if (error) {
       toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
     } else {
       toast({ title: "Project Deleted", description: "The project has been removed." });
       fetchProjects();
     }
 
     setIsDeleteDialogOpen(false);
     setEditingProject(null);
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
           <div className="w-10 h-10 rounded-lg bg-accent/30 flex items-center justify-center">
             <FolderOpen className="h-5 w-5 text-accent-foreground" />
           </div>
           <div>
             <h2 className="text-xl font-bold">Project Management</h2>
             <p className="text-sm text-muted-foreground">Create standalone projects with code and simulations</p>
           </div>
         </div>
         <Button variant="hero" onClick={() => handleOpenDialog()}>
           <Plus className="mr-2 h-4 w-4" />
           Add Project
         </Button>
       </div>
 
       {isLoading ? (
         <div className="flex items-center justify-center py-12">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       ) : projects.length === 0 ? (
         <div className="text-center py-12 rounded-xl bg-card border border-border">
           <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
           <p className="text-muted-foreground">No projects found. Create your first project!</p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {projects.map((project) => (
             <div
               key={project.id}
               className="rounded-xl bg-card border border-border hover:border-primary/30 transition-colors overflow-hidden"
             >
               <div className="aspect-video bg-muted relative">
                 {project.image_url ? (
                   <img src={project.image_url} alt={project.name} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center">
                     <FolderOpen className="h-12 w-12 text-muted-foreground opacity-50" />
                   </div>
                 )}
                 <div className="absolute top-2 left-2 flex gap-2">
                   <Badge className={getDifficultyColor(project.difficulty_level)}>
                     {project.difficulty_level}
                   </Badge>
                 </div>
               </div>
               <div className="p-4">
                 <div className="flex items-start justify-between gap-2 mb-2">
                   <h3 className="font-semibold">{project.name}</h3>
                   <Badge variant="outline" className="text-xs">{project.category}</Badge>
                 </div>
                 <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                 {project.simulation_url && (
                   <a 
                     href={project.simulation_url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-xs text-primary flex items-center gap-1 hover:underline mb-3"
                   >
                     <ExternalLink className="h-3 w-3" />
                     View Simulation
                   </a>
                 )}
                 <div className="flex items-center gap-2">
                   <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(project)}>
                     <Pencil className="h-4 w-4 mr-1" />
                     Edit
                   </Button>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => {
                       setEditingProject(project);
                       setIsDeleteDialogOpen(true);
                     }}
                   >
                     <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                     Delete
                   </Button>
                 </div>
               </div>
             </div>
           ))}
         </div>
       )}
 
       {/* Add/Edit Dialog */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>{editingProject ? "Edit Project" : "Add New Project"}</DialogTitle>
             <DialogDescription>
               {editingProject ? "Update the project details." : "Create a new standalone project."}
             </DialogDescription>
           </DialogHeader>
           <div className="grid gap-4 py-4">
             <div className="grid gap-2">
               <Label>Project Name</Label>
               <Input
                 value={formData.name}
                 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                 placeholder="Enter project name"
               />
             </div>
             <div className="grid gap-2">
               <Label>Description</Label>
               <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Brief description of the project"
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <Label>Difficulty Level</Label>
                 <Select
                   value={formData.difficulty_level}
                   onValueChange={(value: Project["difficulty_level"]) =>
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
                   onValueChange={(value: Project["category"]) =>
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
             <div className="grid gap-2">
               <Label>Components (comma-separated)</Label>
               <Input
                 value={formData.components}
                 onChange={(e) => setFormData({ ...formData, components: e.target.value })}
                 placeholder="ESP32, LED, Resistor, Breadboard"
               />
             </div>
             <div className="grid gap-2">
               <Label>Image URL</Label>
               <Input
                 value={formData.image_url}
                 onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                 placeholder="https://..."
               />
             </div>
             <div className="grid gap-2">
               <Label>Circuit Diagram URL</Label>
               <Input
                 value={formData.circuit_diagram_url}
                 onChange={(e) => setFormData({ ...formData, circuit_diagram_url: e.target.value })}
                 placeholder="https://..."
               />
             </div>
             <div className="grid gap-2">
               <Label>Simulation URL (Wokwi/Tinkercad)</Label>
               <Input
                 value={formData.simulation_url}
                 onChange={(e) => setFormData({ ...formData, simulation_url: e.target.value })}
                 placeholder="https://wokwi.com/projects/..."
               />
             </div>
             <div className="grid grid-cols-4 gap-4">
               <div className="col-span-1">
                 <Label>Language</Label>
                 <Select
                   value={formData.code_language}
                   onValueChange={(value) => setFormData({ ...formData, code_language: value })}
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="cpp">C++</SelectItem>
                     <SelectItem value="arduino">Arduino</SelectItem>
                     <SelectItem value="python">Python</SelectItem>
                     <SelectItem value="javascript">JavaScript</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="col-span-3">
                 <Label>Code</Label>
                 <Textarea
                   value={formData.code}
                   onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                   placeholder="Enter the project code..."
                   className="font-mono text-sm h-32"
                 />
               </div>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="hero" onClick={handleSave} disabled={!formData.name}>
               {editingProject ? "Save Changes" : "Add Project"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Delete Dialog */}
       <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
         <DialogContent className="sm:max-w-[400px]">
           <DialogHeader>
             <DialogTitle>Delete Project</DialogTitle>
             <DialogDescription>
               Are you sure you want to delete "{editingProject?.name}"? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
               Cancel
             </Button>
             <Button variant="destructive" onClick={handleDelete}>
               Delete Project
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default ProjectManager;