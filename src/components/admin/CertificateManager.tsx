import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Search, Filter } from "lucide-react";

interface CertificateRow {
  id: string;
  certificate_number: string;
  learner_name: string;
  program_title: string;
  score: number | null;
  certificate_type: string;
  issued_at: string;
  user_id: string;
}

interface Program {
  id: string;
  title: string;
}

export const CertificateManager = () => {
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");

  useEffect(() => {
    fetchCertificates();
    fetchPrograms();
  }, []);

  const fetchCertificates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .order("issued_at", { ascending: false });

    if (!error && data) {
      setCertificates(data as unknown as CertificateRow[]);
    }
    setIsLoading(false);
  };

  const fetchPrograms = async () => {
    const { data } = await supabase.from("programs").select("id, title").order("title");
    if (data) setPrograms(data);
  };

  // Extract unique years from certificates
  const years = [...new Set(certificates.map((c) => new Date(c.issued_at).getFullYear()))].sort((a, b) => b - a);

  const months = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  const filtered = certificates.filter((c) => {
    const matchesSearch =
      c.learner_name.toLowerCase().includes(search.toLowerCase()) ||
      c.certificate_number.toLowerCase().includes(search.toLowerCase()) ||
      c.program_title.toLowerCase().includes(search.toLowerCase());

    const date = new Date(c.issued_at);
    const matchesProgram = filterProgram === "all" || c.program_title === filterProgram;
    const matchesYear = filterYear === "all" || date.getFullYear().toString() === filterYear;
    const matchesMonth = filterMonth === "all" || date.getMonth().toString() === filterMonth;

    return matchesSearch && matchesProgram && matchesYear && matchesMonth;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Certificate Management</h2>
        <p className="text-muted-foreground">View and filter all issued certificates.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, or program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.title}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold">{filtered.length}</p>
          <p className="text-sm text-muted-foreground">Total Certificates</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold">
            {filtered.filter((c) => c.certificate_type === "completion").length}
          </p>
          <p className="text-sm text-muted-foreground">Completion Certificates</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-2xl font-bold">
            {filtered.filter((c) => c.certificate_type === "participation").length}
          </p>
          <p className="text-sm text-muted-foreground">Participation Certificates</p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading certificates...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No certificates found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate Code</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Issued Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell className="font-mono text-xs">{cert.certificate_number}</TableCell>
                  <TableCell className="font-medium">{cert.learner_name}</TableCell>
                  <TableCell>{cert.program_title}</TableCell>
                  <TableCell>
                    <Badge
                      variant={cert.certificate_type === "completion" ? "default" : "secondary"}
                    >
                      {cert.certificate_type === "completion" ? "Completion" : "Participation"}
                    </Badge>
                  </TableCell>
                  <TableCell>{cert.score !== null ? `${cert.score}%` : "—"}</TableCell>
                  <TableCell>{new Date(cert.issued_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
