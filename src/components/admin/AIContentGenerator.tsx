import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, 
  Copy, 
  Check, 
  Loader2,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  FileText,
  Image
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUploadZone } from "./FileUploadZone";
import { Switch } from "@/components/ui/switch";

interface Kit {
  id: number;
  name: string;
  description: string;
  category: "robotics" | "iot";
  sessions: number;
  image: string;
}

interface UploadedFile {
  id: string;
  file: File;
  type: "document" | "image" | "code";
  preview?: string;
  content?: string;
  relativePath?: string;
}

interface GeneratedBlock {
  type: "text" | "code" | "tip" | "safety_note" | "image" | "problem" | "solution" | "components" | "circuit_diagram" | "questions" | "feedback";
  title?: string;
  content: string;
  codeLanguage?: string;
  imageUrl?: string;
}

interface GeneratedSessionContent {
  sessionTitle: string;
  blocks: GeneratedBlock[];
}

interface AIContentGeneratorProps {
  kits: Kit[];
  onContentGenerated?: (content: GeneratedSessionContent[]) => void;
}

export const AIContentGenerator = ({ kits, onContentGenerated }: AIContentGeneratorProps) => {
  const [selectedKitId, setSelectedKitId] = useState<string>("");
  const [inputContent, setInputContent] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [numberOfSessions, setNumberOfSessions] = useState<number>(1);
  const [generateImages, setGenerateImages] = useState(false);
  const [imageMarkers, setImageMarkers] = useState<string[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [userInstructions, setUserInstructions] = useState("");
  const { toast } = useToast();

  const selectedKit = kits.find(k => k.id.toString() === selectedKitId);

  const handleGenerate = async () => {
    if (!selectedKit || (!inputContent.trim() && uploadedFiles.length === 0)) {
      toast({
        title: "Missing Information",
        description: "Please select a kit and provide content or upload files.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setImageMarkers([]);
    
    try {
      const filesData = uploadedFiles.map(f => ({
        name: f.file.name,
        type: f.type,
        content: f.content || null,
        relativePath: f.relativePath || null,
      }));

      const { data, error } = await supabase.functions.invoke("generate-learning-content", {
        body: {
          kitName: selectedKit.name,
          kitCategory: selectedKit.category,
          inputContent: inputContent,
          uploadedFiles: filesData,
          numberOfSessions: numberOfSessions,
          generateImages: generateImages,
          userInstructions: userInstructions,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const rawContent = data?.content || "";
      setGeneratedContent(rawContent);

      if (data?.imageMarkers && data.imageMarkers.length > 0) {
        setImageMarkers(data.imageMarkers);
        toast({
          title: "Content Organized",
          description: `${data.imageMarkers.length} image locations identified.`
        });
      } else {
        toast({
          title: "Content Organized",
          description: "Your content has been structured into sessions. Review and populate."
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePendingImages = async () => {
    if (imageMarkers.length === 0) return;
    setIsGeneratingImages(true);
    let successCount = 0;

    for (const marker of imageMarkers) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-content-image", {
          body: { prompt: marker }
        });
        if (!error && data?.imageUrl) {
          successCount++;
          setGeneratedContent(prev => 
            prev.replace(`[GENERATE_IMAGE: ${marker}]`, `![${marker}](${data.imageUrl})`)
          );
        }
      } catch (err) {
        console.error("Image generation error:", err);
      }
    }

    setIsGeneratingImages(false);
    toast({
      title: "Images Generated",
      description: `Successfully generated ${successCount} of ${imageMarkers.length} images.`
    });
    setImageMarkers([]);
  };

  const parseAndPopulateContent = () => {
    const sessions = parseMarkdownToSessions(generatedContent);
    if (sessions.length === 0) {
      toast({
        title: "No Sessions Found",
        description: "Could not parse session content.",
        variant: "destructive"
      });
      return;
    }
    if (onContentGenerated) {
      onContentGenerated(sessions);
    }
  };

  const parseMarkdownToSessions = (markdown: string): GeneratedSessionContent[] => {
    const sessions: GeneratedSessionContent[] = [];
    const sessionRegex = /(?:^|\n)##?\s*(?:Session\s*\d+[:\s]*)?([^\n]+)/gi;
    const parts = markdown.split(sessionRegex);
    
    if (parts.length <= 1) {
      sessions.push({
        sessionTitle: "Generated Content",
        blocks: parseBlocksFromContent(markdown)
      });
      return sessions;
    }

    for (let i = 1; i < parts.length; i += 2) {
      const title = parts[i]?.trim() || `Session ${Math.floor(i/2) + 1}`;
      const content = parts[i + 1] || "";
      if (content.trim()) {
        sessions.push({
          sessionTitle: title,
          blocks: parseBlocksFromContent(content)
        });
      }
    }
    return sessions;
  };

  const parseBlocksFromContent = (content: string): GeneratedBlock[] => {
    const blocks: GeneratedBlock[] = [];
    const lines = content.split('\n');
    let currentBlock: GeneratedBlock | null = null;
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
          inCodeBlock = false;
        } else {
          if (currentBlock) blocks.push(currentBlock);
          const lang = line.trim().replace('```', '').toLowerCase() || 'arduino';
          currentBlock = { type: "code", content: "", codeLanguage: lang };
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock && currentBlock) {
        currentBlock.content += (currentBlock.content ? '\n' : '') + line;
        continue;
      }

      if (line.toLowerCase().includes('safety note:') || line.toLowerCase().includes('safety:')) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "safety_note", title: "Safety Note", content: line.replace(/safety\s*(note)?:\s*/i, '').trim() };
        continue;
      }

      if (line.toLowerCase().includes('tip:')) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "tip", title: "Tip", content: line.replace(/tip:\s*/i, '').trim() };
        continue;
      }

      const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imageMatch) {
        if (currentBlock) blocks.push(currentBlock);
        blocks.push({ type: "image", title: imageMatch[1] || "Image", content: imageMatch[1] || "", imageUrl: imageMatch[2] });
        currentBlock = null;
        continue;
      }

      if (line.match(/^#{3,4}\s+/)) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: "text", title: line.replace(/^#+\s*/, '').trim(), content: "" };
        continue;
      }

      if (line.trim()) {
        if (!currentBlock) {
          currentBlock = { type: "text", content: "" };
        }
        currentBlock.content += (currentBlock.content ? '\n' : '') + line;
      }
    }

    if (currentBlock && currentBlock.content.trim()) {
      blocks.push(currentBlock);
    }
    return blocks.filter(b => b.content.trim());
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Content copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold">AI Content Organizer</h2>
          <p className="text-sm text-muted-foreground">
            Upload PDFs and content - AI organizes it into sessions faithfully
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-card border border-border">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Kit</Label>
                <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a kit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={kit.id.toString()}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Sessions</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={numberOfSessions}
                    onChange={(e) => setNumberOfSessions(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Generate Images</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={generateImages} onCheckedChange={setGenerateImages} aria-label="Generate Images" />
                    <span className="text-sm text-muted-foreground">
                      {generateImages ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Your Instructions to AI</Label>
                <Textarea
                  placeholder={`Tell the AI exactly what to do:

e.g. "Create 1 session with 3 sub-sections from the uploaded PDF. Keep all content as-is."
e.g. "Organize this into 2 sub-sections: Hardware Setup and Software Setup"
e.g. "Paste the PDF content directly, don't change anything"`}
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Upload PDF / Reference Files</Label>
                <FileUploadZone 
                  files={uploadedFiles} 
                  onFilesChange={setUploadedFiles} 
                />
              </div>

              <div className="space-y-2">
                <Label>Additional Content (Optional)</Label>
                <Textarea
                  placeholder="Paste additional content here. This will be organized alongside uploaded files..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                />
              </div>

              <Button 
                variant="hero" 
                className="w-full"
                onClick={handleGenerate}
                disabled={isGenerating || !selectedKitId || (!inputContent.trim() && uploadedFiles.length === 0)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Organizing Content...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Organize into Session(s)
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Tips Card */}
          <div className="p-4 rounded-xl bg-accent/20 border border-accent/30">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-sm">How it works:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>1. Upload your PDF with session content</li>
                  <li>2. Tell the AI how many sessions and sub-sections</li>
                  <li>3. AI organizes YOUR content faithfully (max 3 sub-sections + test)</li>
                  <li>4. Review, edit, then populate to the editor</li>
                  <li>5. Upload images separately in the content editor</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-card border border-border min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <Label>Organized Content</Label>
              </div>
              <div className="flex gap-2 flex-wrap">
                {imageMarkers.length > 0 && (
                  <Button variant="outline" size="sm" onClick={generatePendingImages} disabled={isGeneratingImages}>
                    {isGeneratingImages ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Image className="h-4 w-4 mr-1" />}
                    Generate {imageMarkers.length} Images
                  </Button>
                )}
                {generatedContent && onContentGenerated && (
                  <Button variant="hero" size="sm" onClick={parseAndPopulateContent}>
                    <FileText className="h-4 w-4 mr-1" />
                    Populate to Editor
                  </Button>
                )}
                {generatedContent && (
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </div>

            {generatedContent ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm text-foreground font-mono bg-muted/50 p-4 rounded-lg max-h-[350px] overflow-y-auto">
                  {generatedContent}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Upload PDFs and provide instructions</p>
                <p className="text-xs mt-1">AI will organize your content into sessions with max 3 sub-sections</p>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-destructive">Review before publishing</p>
                <p className="text-xs text-muted-foreground">
                  Always review organized content for accuracy before adding to sessions. Upload images via the content editor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIContentGenerator;
