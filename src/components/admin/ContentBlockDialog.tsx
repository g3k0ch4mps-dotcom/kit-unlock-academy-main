import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "./RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentBlock {
  id: string;
  session_id: string;
  block_type: "text" | "image" | "code" | "diagram" | "video" | "safety_note" | "tip" | "problem" | "solution" | "components" | "circuit_diagram" | "questions" | "feedback" | "introduction" | "simulation";
  block_order: number;
  title: string | null;
  content: string | null;
  code_language: string | null;
  image_url: string | null;
}

interface BlockFormState {
  block_type: ContentBlock["block_type"];
  title: string;
  content: string;
  code_language: string;
  image_url: string;
}

interface ContentBlockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingBlock: ContentBlock | null;
  blockForm: BlockFormState;
  setBlockForm: (form: BlockFormState) => void;
  isSaving: boolean;
  onSave: () => void;
}

export const ContentBlockDialog = ({
  isOpen,
  onOpenChange,
  editingBlock,
  blockForm,
  setBlockForm,
  isSaving,
  onSave,
}: ContentBlockDialogProps) => {
  const { toast } = useToast();
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingBlock ? "Edit Content Block" : "Add Content Block"}
          </DialogTitle>
          <DialogDescription>
            Create educational content for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Block Type</Label>
            <Select
              value={blockForm.block_type}
              onValueChange={(v) => setBlockForm({ ...blockForm, block_type: v as ContentBlock["block_type"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="tip">Tip</SelectItem>
                <SelectItem value="safety_note">Safety Note</SelectItem>
                <SelectItem value="diagram">Diagram</SelectItem>
                <SelectItem value="problem">Problem Statement</SelectItem>
                <SelectItem value="solution">Solution</SelectItem>
                <SelectItem value="components">Components List</SelectItem>
                <SelectItem value="circuit_diagram">Circuit Diagram</SelectItem>
                <SelectItem value="questions">Review Questions</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              value={blockForm.title}
              onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })}
              placeholder="Block title..."
            />
          </div>

          {blockForm.block_type === "code" && (
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={blockForm.code_language}
                onValueChange={(v) => setBlockForm({ ...blockForm, code_language: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arduino">Arduino C/C++</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="micropython">MicroPython</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(blockForm.block_type === "image" || blockForm.block_type === "diagram" || blockForm.block_type === "circuit_diagram") && (
            <div className="space-y-3">
              <Label>Image</Label>
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                      const filePath = `content-images/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('kit-images')
                        .upload(filePath, file);

                      if (uploadError) throw uploadError;

                      const { data: urlData } = supabase.storage
                        .from('kit-images')
                        .getPublicUrl(filePath);

                      setBlockForm({ ...blockForm, image_url: urlData.publicUrl });
                      toast({ title: "Image Uploaded", description: "Image uploaded successfully." });
                    } catch (err: any) {
                      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                    }
                  }}
                  className="cursor-pointer"
                />
                <div className="text-xs text-muted-foreground">Or paste a URL below:</div>
                <Input
                  value={blockForm.image_url}
                  onChange={(e) => setBlockForm({ ...blockForm, image_url: e.target.value })}
                  placeholder="https://..."
                />
                {blockForm.image_url && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <img src={blockForm.image_url} alt="Preview" className="w-full max-h-[200px] object-contain" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Content</Label>
            {blockForm.block_type === "code" ? (
              <Textarea
                ref={contentTextareaRef}
                value={blockForm.content}
                onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })}
                placeholder="Enter your code here..."
                className="font-mono text-sm"
                rows={10}
              />
            ) : (
              <RichTextEditor
                content={blockForm.content}
                onChange={(html) => setBlockForm({ ...blockForm, content: html })}
                placeholder="Start typing or paste content with images..."
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="hero" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Block
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
