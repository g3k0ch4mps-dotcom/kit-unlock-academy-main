import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Camera, Loader2, Award, Download, ExternalLink } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Certificate {
  id: string;
  certificate_number: string;
  certificate_url: string | null;
  program_title: string;
  score: number | null;
  issued_at: string;
  learner_name: string;
}

export const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCertificates();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id).maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      toast({ title: "Failed to load profile", variant: "destructive" });
    } else {
      setProfile(data as Profile);
      setFullName(data.full_name || "");
    }
    setIsLoading(false);
  };

  const fetchCertificates = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", user.id)
      .order("issued_at", { ascending: false });

    if (error) {
      console.error("Error fetching certificates:", error);
      toast({ title: "Failed to load certificates", variant: "destructive" });
    } else {
      setCertificates(data as Certificate[]);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">My Profile</h1>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="certificates" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certificates ({certificates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="bg-card rounded-xl border border-border p-8 space-y-8">
                {/* Avatar Section */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt="Avatar" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-12 w-12 text-primary" />
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{fullName || "Your Name"}</h2>
                    <p className="text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile?.email || ""}
                        disabled
                        className="pl-10 bg-muted"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                  </div>

                  <Button 
                    variant="hero" 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="certificates">
              {certificates.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center">
                  <Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete a program and pass the final test to earn your first certificate.
                  </p>
                  <Button variant="outline" asChild>
                    <a href="/programs">Browse Programs</a>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {certificates.map((cert) => (
                    <Card key={cert.id} className="overflow-hidden">
                      <CardHeader className="bg-gradient-primary text-primary-foreground">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Award className="h-5 w-5" />
                              {cert.program_title}
                            </CardTitle>
                            <CardDescription className="text-primary-foreground/80">
                              Certificate #{cert.certificate_number}
                            </CardDescription>
                          </div>
                          {cert.score !== null && (
                            <div className="text-right">
                              <p className="text-2xl font-bold">{cert.score}%</p>
                              <p className="text-xs text-primary-foreground/80">Final Score</p>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            <p>Issued to: <span className="font-medium text-foreground">{cert.learner_name}</span></p>
                            <p>Date: {new Date(cert.issued_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2">
                            {cert.certificate_url && (
                              <>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={cert.certificate_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View
                                  </a>
                                </Button>
                                <Button variant="hero" size="sm" asChild>
                                  <a href={cert.certificate_url} download>
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;

