import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Package,
  Bot,
  Cpu,
  Sparkles,
  Key,
   FileText,
   BookOpen,
   FolderOpen,
   ClipboardCheck,
    Award,
    BarChart3,
    HelpCircle,
   Undo2,
   AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KitCard } from "@/components/admin/KitCard";
import { AddKitDialog, EditKitDialog, DeleteKitDialog } from "@/components/admin/KitDialogs";
import { AIContentGenerator } from "@/components/admin/AIContentGenerator";
import { UnlockCodeManager } from "@/components/admin/UnlockCodeManager";
import { SessionContentEditor, SessionContentEditorRef } from "@/components/admin/SessionContentEditor";
 import { ProgramManager } from "@/components/admin/ProgramManager";
 import { ProjectManager } from "@/components/admin/ProjectManager";
 import { TestManager } from "@/components/admin/TestManager";
import { QuizBuilder } from "@/components/admin/QuizBuilder";
import { ProgramAnalytics } from "@/components/admin/ProgramAnalytics";
import { CertificateManager } from "@/components/admin/CertificateManager";

export interface GeneratedSessionContent {
  sessionTitle: string;
  blocks: Array<{
     type: "text" | "code" | "tip" | "safety_note" | "image" | "problem" | "solution" | "components" | "circuit_diagram" | "questions" | "feedback" | "introduction" | "simulation";
    title?: string;
    content: string;
    codeLanguage?: string;
    imageUrl?: string;
  }>;
}

interface Kit {
  id: string;
  name: string;
  description: string | null;
  category: "robotics" | "iot";
  total_sessions: number;
  image_url: string | null;
  difficulty_level?: "beginner" | "intermediate" | "advanced";
  deleted_at?: string | null;
}

export const Admin = () => {
  const [kits, setKits] = useState<Kit[]>([]);
  const [deletedKits, setDeletedKits] = useState<Kit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [activeTab, setActiveTab] = useState("kits");
  const [generatedContent, setGeneratedContent] = useState<GeneratedSessionContent[] | null>(null);
  const contentEditorRef = useRef<SessionContentEditorRef>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "robotics" as "robotics" | "iot",
    sessions: 10,
    image: "",
    difficulty_level: "beginner" as "beginner" | "intermediate" | "advanced",
    createProgram: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchKits();
  }, []);

  const fetchKits = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("kits")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load kits.",
        variant: "destructive"
      });
    } else {
      const allKits = (data || []).map(kit => ({
        ...kit,
        category: kit.category as "robotics" | "iot"
      }));
      // Separate active vs soft-deleted (within 24h)
      const now = new Date();
      const activeKits = allKits.filter(k => !k.deleted_at);
      const recentlyDeleted = allKits.filter(k => {
        if (!k.deleted_at) return false;
        const deletedTime = new Date(k.deleted_at);
        return (now.getTime() - deletedTime.getTime()) < 24 * 60 * 60 * 1000;
      });
      setKits(activeKits);
      setDeletedKits(recentlyDeleted);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "robotics",
      sessions: 10,
      image: "",
      difficulty_level: "beginner",
      createProgram: false
    });
  };

  const handleAdd = async () => {
    const { data: kitData, error } = await supabase
      .from("kits")
      .insert({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        total_sessions: formData.sessions,
        image_url: formData.image || null,
        difficulty_level: formData.difficulty_level
      })
      .select().maybeSingle();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add kit.",
        variant: "destructive"
      });
    } else {
      // Auto-create matching program if toggle is on
      if (formData.createProgram && kitData) {
        const { error: programError } = await supabase
          .from("programs")
          .insert({
            title: formData.name,
            description: formData.description,
            category: formData.category,
            difficulty_level: formData.difficulty_level,
            total_sessions: formData.sessions,
            image_url: formData.image || null,
            kit_id: kitData.id,
            estimated_hours: Math.ceil(formData.sessions * 0.5) // 30 min per session
          });

        if (programError) {
          toast({
            title: "Warning",
            description: "Kit added but failed to create matching program.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Kit & Program Added",
            description: `${formData.name} and its matching program have been created.`
          });
        }
      } else {
        toast({
          title: "Kit Added",
          description: `${formData.name} has been added successfully.`
        });
      }
      fetchKits();
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  const handleEdit = async () => {
    if (!selectedKit) return;
    
    const { error } = await supabase
      .from("kits")
      .update({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        total_sessions: formData.sessions,
         image_url: formData.image || null,
         difficulty_level: formData.difficulty_level
      })
      .eq("id", selectedKit.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update kit.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Kit Updated",
        description: "The kit has been updated successfully."
      });
      fetchKits();
      setIsEditDialogOpen(false);
      setSelectedKit(null);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!selectedKit) return;
    setDeleteError(null);

    // Cascade validation: check for dependent programs
    const { data: programs } = await supabase
      .from("programs")
      .select("id, title")
      .eq("kit_id", selectedKit.id);

    if (programs && programs.length > 0) {
      const names = programs.map(p => p.title).join(", ");
      setDeleteError(`This kit has ${programs.length} linked program(s): ${names}. Remove or unlink them first.`);
      return;
    }

    // Check for dependent unlock codes
    const { data: codes } = await supabase
      .from("unlock_codes")
      .select("id")
      .eq("kit_id", selectedKit.id)
      .limit(1);

    if (codes && codes.length > 0) {
      setDeleteError("This kit has linked unlock codes. Remove them first.");
      return;
    }

    // Soft-delete: set deleted_at timestamp
    const { error } = await supabase
      .from("kits")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", selectedKit.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete kit.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Kit Deleted",
        description: "You can undo this within 24 hours.",
      });
      fetchKits();
      setIsDeleteDialogOpen(false);
      setSelectedKit(null);
    }
  };

  const handleRestore = async (kit: Kit) => {
    const { error } = await supabase
      .from("kits")
      .update({ deleted_at: null } as any)
      .eq("id", kit.id);

    if (error) {
      toast({ title: "Error", description: "Failed to restore kit.", variant: "destructive" });
    } else {
      toast({ title: "Kit Restored", description: `${kit.name} has been restored.` });
      fetchKits();
    }
  };

  const handlePermanentDelete = async (kit: Kit) => {
    const { error } = await supabase
      .from("kits")
      .delete()
      .eq("id", kit.id);

    if (error) {
      toast({ title: "Error", description: "Failed to permanently delete kit.", variant: "destructive" });
    } else {
      toast({ title: "Kit Permanently Deleted", description: `${kit.name} has been removed forever.` });
      fetchKits();
    }
  };

  const openEditDialog = (kit: any) => {
    setSelectedKit(kit);
    setFormData({
      name: kit.name,
      description: kit.description || "",
      category: kit.category,
      sessions: kit.total_sessions || kit.sessions || 10,
      image: kit.image_url || kit.image || "",
      difficulty_level: kit.difficulty_level || "beginner",
      createProgram: false
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (kit: any) => {
    setSelectedKit(kit);
    setIsDeleteDialogOpen(true);
  };

  // Map database kit format to component format
  const mappedKits = kits.map(kit => ({
    id: parseInt(kit.id.substring(0, 8), 16), // Convert UUID to number for component
    name: kit.name,
    description: kit.description || "",
    category: kit.category,
    sessions: kit.total_sessions,
    image: kit.image_url || "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop"
  }));

  const roboticsKits = mappedKits.filter(k => k.category === "robotics");
  const iotKits = mappedKits.filter(k => k.category === "iot");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage kits, content, unlock codes, and AI-generated learning materials.</p>
        </div>

         <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
           <TabsList className="flex flex-wrap gap-1 h-auto p-1 w-full max-w-4xl">
             <TabsTrigger value="kits" className="flex items-center gap-2">
               <Package className="h-4 w-4" />
               <span className="hidden sm:inline">Kits</span>
             </TabsTrigger>
             <TabsTrigger value="programs" className="flex items-center gap-2">
               <BookOpen className="h-4 w-4" />
               <span className="hidden sm:inline">Programs</span>
             </TabsTrigger>
             <TabsTrigger value="projects" className="flex items-center gap-2">
               <FolderOpen className="h-4 w-4" />
               <span className="hidden sm:inline">Projects</span>
             </TabsTrigger>
             <TabsTrigger value="content" className="flex items-center gap-2">
               <FileText className="h-4 w-4" />
               <span className="hidden sm:inline">Content</span>
             </TabsTrigger>
             <TabsTrigger value="tests" className="flex items-center gap-2">
               <ClipboardCheck className="h-4 w-4" />
               <span className="hidden sm:inline">Tests</span>
             </TabsTrigger>
             <TabsTrigger value="codes" className="flex items-center gap-2">
               <Key className="h-4 w-4" />
               <span className="hidden sm:inline">Codes</span>
             </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
               <TabsTrigger value="quizzes" className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Quizzes</span>
                </TabsTrigger>
               <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
               <TabsTrigger value="certificates" className="flex items-center gap-2">
                 <Award className="h-4 w-4" />
                 <span className="hidden sm:inline">Certificates</span>
               </TabsTrigger>
            </TabsList>

          {/* Kits Tab */}
          <TabsContent value="kits" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Kit Management</h2>
                <p className="text-muted-foreground">Add, edit, and manage hardware kits.</p>
              </div>
              <Button variant="hero" onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Kit
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{kits.length}</p>
                    <p className="text-sm text-muted-foreground">Total Kits</p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{roboticsKits.length}</p>
                    <p className="text-sm text-muted-foreground">Robotics Kits</p>
                  </div>
                </div>
              </div>
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/30 flex items-center justify-center">
                    <Cpu className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{iotKits.length}</p>
                    <p className="text-sm text-muted-foreground">IoT Kits</p>
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading kits...</p>
              </div>
            ) : kits.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-card border border-border">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No kits found. Add your first kit!</p>
              </div>
            ) : (
              <>
                {/* Robotics Kits */}
                {roboticsKits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Bot className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-bold">Robotics Kits</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {roboticsKits.map((kit) => (
                        <KitCard 
                          key={kit.id} 
                          kit={kit} 
                          onEdit={openEditDialog} 
                          onDelete={openDeleteDialog} 
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* IoT Kits */}
                {iotKits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Cpu className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-bold">IoT Kits</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {iotKits.map((kit) => (
                        <KitCard 
                          key={kit.id} 
                          kit={kit} 
                          variant="compact"
                          onEdit={openEditDialog} 
                          onDelete={openDeleteDialog} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Recently Deleted Kits - Undo Banner */}
            {deletedKits.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Undo2 className="h-4 w-4" />
                  Recently Deleted ({deletedKits.length}) — recoverable for 24 hours
                </div>
                {deletedKits.map(kit => (
                  <div key={kit.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      {kit.image_url && (
                        <img src={kit.image_url} alt={kit.name} className="w-10 h-10 rounded object-cover" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{kit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Deleted {kit.deleted_at ? new Date(kit.deleted_at).toLocaleString() : "recently"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRestore(kit)}>
                        <Undo2 className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handlePermanentDelete(kit)}>
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

           {/* Programs Tab */}
           <TabsContent value="programs">
             <ProgramManager />
           </TabsContent>
 
           {/* Projects Tab */}
           <TabsContent value="projects">
             <ProjectManager />
           </TabsContent>
 
          {/* Content Tab */}
          <TabsContent value="content">
            <SessionContentEditor 
              ref={contentEditorRef}
              generatedContent={generatedContent}
              onContentProcessed={() => setGeneratedContent(null)}
            />
          </TabsContent>

           {/* Tests Tab */}
           <TabsContent value="tests">
             <TestManager />
           </TabsContent>
 
          {/* Codes Tab */}
          <TabsContent value="codes">
            <UnlockCodeManager />
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai">
            <AIContentGenerator 
              kits={mappedKits} 
              onContentGenerated={(content) => {
                setGeneratedContent(content);
                setActiveTab("content");
                toast({
                  title: "Content Ready for Review",
                  description: "AI-generated content has been loaded into the Content Editor. Review and save each session.",
                });
              }}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="quizzes">
             <div className="bg-card rounded-xl border border-border p-6">
               <h2 className="text-xl font-semibold mb-6">Session Quiz Builder</h2>
               <QuizBuilder />
             </div>
           </TabsContent>
          <TabsContent value="analytics">
             <ProgramAnalytics />
           </TabsContent>

           {/* Certificates Tab */}
           <TabsContent value="certificates">
             <CertificateManager />
           </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      <AddKitDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onAdd={handleAdd}
      />

      <EditKitDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onEdit={handleEdit}
      />

      <DeleteKitDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setDeleteError(null);
        }}
        kitName={selectedKit?.name}
        onDelete={handleDelete}
        errorMessage={deleteError}
      />

      <Footer />
    </div>
  );
};

export default Admin;

