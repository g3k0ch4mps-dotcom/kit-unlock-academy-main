import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Users, Brain, TrendingUp, Loader2 } from "lucide-react";

interface Program {
  id: string;
  title: string;
}

interface AssessmentStats {
  total: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  skipped: number;
}

interface ProgressStats {
  totalLearners: number;
  avgCompletion: number;
  completedSessions: number;
  totalSessions: number;
}

export const ProgramAnalytics = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [assessmentStats, setAssessmentStats] = useState<AssessmentStats>({ total: 0, beginner: 0, intermediate: 0, advanced: 0, skipped: 0 });
  const [progressStats, setProgressStats] = useState<ProgressStats>({ totalLearners: 0, avgCompletion: 0, completedSessions: 0, totalSessions: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgram) fetchAnalytics(selectedProgram);
  }, [selectedProgram]);

  const fetchPrograms = async () => {
    const { data } = await supabase.from("programs").select("id, title").order("title");
    if (data) setPrograms(data);
  };

  const fetchAnalytics = async (programId: string) => {
    setIsLoading(true);

    // Fetch assessments for this program
    const { data: assessments } = await supabase
      .from("user_assessments")
      .select("skill_level")
      .eq("program_id", programId);

    // Fetch program access count (enrolled users)
    const { data: accessData } = await supabase
      .from("user_program_access")
      .select("user_id")
      .eq("program_id", programId);

    // Fetch sessions for this program
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("program_id", programId);

    // Fetch session progress for this program's sessions
    const sessionIds = sessions?.map(s => s.id) || [];
    let completedCount = 0;
    let totalProgressEntries = 0;

    if (sessionIds.length > 0) {
      const { data: progress } = await supabase
        .from("session_progress")
        .select("completed, progress_percentage")
        .in("session_id", sessionIds);

      if (progress) {
        completedCount = progress.filter(p => p.completed).length;
        totalProgressEntries = progress.length;
      }
    }

    const totalEnrolled = accessData?.length || 0;
    const assessmentList = assessments || [];
    const beginnerCount = assessmentList.filter(a => a.skill_level === "beginner").length;
    const intermediateCount = assessmentList.filter(a => a.skill_level === "intermediate").length;
    const advancedCount = assessmentList.filter(a => a.skill_level === "advanced").length;
    const skippedCount = Math.max(0, totalEnrolled - assessmentList.length);

    setAssessmentStats({
      total: assessmentList.length,
      beginner: beginnerCount,
      intermediate: intermediateCount,
      advanced: advancedCount,
      skipped: skippedCount,
    });

    setProgressStats({
      totalLearners: totalEnrolled,
      avgCompletion: totalProgressEntries > 0 ? Math.round((completedCount / totalProgressEntries) * 100) : 0,
      completedSessions: completedCount,
      totalSessions: sessionIds.length,
    });

    setIsLoading(false);
  };

  const getPercent = (val: number, total: number) => (total > 0 ? Math.round((val / total) * 100) : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Program Analytics</h2>
          <p className="text-sm text-muted-foreground">Assessment onboarding effectiveness by skill level</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Program</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Select a program..." />
            </SelectTrigger>
            <SelectContent>
              {programs.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {selectedProgram && !isLoading && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{progressStats.totalLearners}</p>
                    <p className="text-sm text-muted-foreground">Enrolled Learners</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{assessmentStats.total}</p>
                    <p className="text-sm text-muted-foreground">Assessments Taken</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{progressStats.avgCompletion}%</p>
                    <p className="text-sm text-muted-foreground">Session Completion</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{assessmentStats.skipped}</p>
                    <p className="text-sm text-muted-foreground">Skipped Assessment</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skill Level Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Skill Level Distribution</CardTitle>
              <CardDescription>How learners are distributed across assessed skill levels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { label: "Beginner", count: assessmentStats.beginner, color: "bg-success" },
                { label: "Intermediate", count: assessmentStats.intermediate, color: "bg-warning" },
                { label: "Advanced", count: assessmentStats.advanced, color: "bg-destructive" },
              ].map(level => {
                const pct = getPercent(level.count, assessmentStats.total || 1);
                return (
                  <div key={level.label} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${level.color}`} />
                        <span className="text-sm font-medium">{level.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{level.count} learners</Badge>
                        <span className="text-sm text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}

              {assessmentStats.total === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No assessments taken yet for this program.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Session Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Progress</CardTitle>
              <CardDescription>Overall session completion across all enrolled learners</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress value={progressStats.avgCompletion} className="h-3" />
                </div>
                <span className="text-sm font-medium">{progressStats.completedSessions} completed</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Across {progressStats.totalSessions} sessions in this program
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedProgram && (
        <div className="text-center py-12 rounded-xl bg-card border border-border">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Select a program to view analytics.</p>
        </div>
      )}
    </div>
  );
};

export default ProgramAnalytics;
