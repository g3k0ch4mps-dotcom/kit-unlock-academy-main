 import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  Lock,
  Unlock,
  ArrowRight,
  Cpu,
  Bot,
  Camera,
   Lightbulb,
   Loader2
} from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";

 interface Program {
   id: string;
   title: string;
   description: string | null;
   difficulty_level: string | null;
   category: string | null;
   image_url: string | null;
   total_sessions: number | null;
   estimated_hours: number | null;
 }

 const categories = ["All", "robotics", "iot", "electronics", "ai_ml", "sensors", "automation"];
 const categoryLabels: Record<string, string> = {
   "All": "All",
   "robotics": "Robotics",
   "iot": "IoT",
   "electronics": "Electronics",
   "ai_ml": "AI/ML",
   "sensors": "Sensors",
   "automation": "Automation",
 };
 const levels = ["All Levels", "beginner", "intermediate", "advanced"];
 const levelLabels: Record<string, string> = {
   "All Levels": "All Levels",
   "beginner": "Beginner",
   "intermediate": "Intermediate",
   "advanced": "Advanced",
 };
 
 const getCategoryIcon = (category: string | null) => {
   switch (category) {
     case "robotics": return Bot;
     case "iot": return Cpu;
     case "ai_ml": return Camera;
     case "electronics": return Lightbulb;
     default: return Cpu;
   }
 };

export const Programs = () => {
   const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
   const [programs, setPrograms] = useState<Program[]>([]);
   const [userAccess, setUserAccess] = useState<string[]>([]);
   const [isLoading, setIsLoading] = useState(true);
 
   useEffect(() => {
     fetchPrograms();
     if (user) {
       fetchUserAccess();
     }
   }, [user]);
 
   const fetchPrograms = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("programs")
       .select("*")
       .order("created_at", { ascending: false });
 
     if (!error && data) {
       setPrograms(data);
     }
     setIsLoading(false);
   };
 
   const fetchUserAccess = async () => {
     if (!user) return;
     const { data } = await supabase
       .from("user_program_access")
       .select("program_id")
       .eq("user_id", user.id);
     
     if (data) {
       setUserAccess(data.map(a => a.program_id));
     }
   };

   const filteredPrograms = programs.filter(program => {
     const matchesSearch = program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (program.description || "").toLowerCase().includes(searchQuery.toLowerCase());
     const matchesCategory = selectedCategory === "All" || program.category === selectedCategory;
     const matchesLevel = selectedLevel === "All Levels" || program.difficulty_level === selectedLevel;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Explore <span className="text-gradient-primary">Programs</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Each program is designed around a specific hardware kit. 
            Preview the first 2 sessions for free, then unlock with your code.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl p-4 mb-8 border border-border">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search programs..." 
                className="pl-10 h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                   {categoryLabels[category] || category}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-sm"
              >
                {levels.map(level => (
                   <option key={level} value={level}>{levelLabels[level] || level}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Programs Grid */}
         {isLoading ? (
           <div className="flex items-center justify-center py-16">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
         ) : filteredPrograms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((program) => {
               const IconComponent = getCategoryIcon(program.category);
               const hasAccess = userAccess.includes(program.id);
              return (
                <div 
                  key={program.id}
                  className="group bg-card rounded-xl overflow-hidden border border-border card-hover"
                >
                  <div className="aspect-video overflow-hidden relative">
                     {program.image_url ? (
                       <img 
                         src={program.image_url} 
                         alt={program.title}
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                       />
                     ) : (
                       <div className="w-full h-full bg-muted flex items-center justify-center">
                         <IconComponent className="h-12 w-12 text-muted-foreground" />
                       </div>
                     )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="text-xs font-medium bg-card/90 backdrop-blur px-2 py-1 rounded-full">
                         {levelLabels[program.difficulty_level || "beginner"] || program.difficulty_level}
                      </span>
                      <span className="text-xs font-medium bg-primary/90 text-primary-foreground px-2 py-1 rounded-full">
                         {categoryLabels[program.category || "iot"] || program.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                         <h3 className="font-semibold mb-1">{program.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {program.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                         <span>{program.total_sessions || 0} sessions</span>
                         {hasAccess ? (
                           <span className="flex items-center gap-1 text-success">
                             <Unlock className="h-4 w-4" />
                             Unlocked
                           </span>
                         ) : (
                           <span className="flex items-center gap-1 text-muted-foreground">
                             <Lock className="h-4 w-4" />
                             Locked
                           </span>
                         )}
                      </div>
                      <Button variant="outline-primary" size="sm" asChild>
                        <Link to={`/programs/${program.id}`}>
                          View
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No programs found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setSelectedLevel("All Levels");
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-accent rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl font-bold mb-3">Have an Unlock Code?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              If you've purchased a hardware kit, you should have received a single-use unlock code.
              Redeem it to get full access to the corresponding program.
            </p>
            <Button variant="dark" size="lg" asChild>
              <Link to="/redeem">
                <Lock className="h-5 w-5 mr-2" />
                Redeem Unlock Code
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Programs;
