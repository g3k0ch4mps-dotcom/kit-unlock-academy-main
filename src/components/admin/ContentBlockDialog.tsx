import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "./RichTextEditor";
import { FileUploadZone } from "./FileUploadZone";
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
import { Save, Loader2, X } from "lucide-react";
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

interface Attachment {
  id: string;
  file_name: string;
  file_type: "document" | "image" | "code";
  file_path: string;
  file_size_bytes?: number;
}

interface UploadedFile {
  id: string;
  file: File;
  type: "document" | "image" | "code";
  preview?: string;
  content?: string;
  relativePath?: string;
}

interface ContentBlockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingBlock: ContentBlock | null;
  blockForm: BlockFormState;
  setBlockForm: (form: BlockFormState) => void;
  isSaving: boolean;
  onSave: () => Promise<void>;
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  // Load existing attachments when editing
  useEffect(() => {
    if (editingBlock && isOpen) {
      loadExistingAttachments(editingBlock.id);
    } else {
      setUploadedFiles([]);
      setExistingAttachments([]);
    }
  }, [editingBlock, isOpen]);

  const loadExistingAttachments = async (blockId: string) => {
    try {
      setIsLoadingAttachments(true);
      const { data, error } = await supabase
        .from("content_block_attachments")
        .select("*")
        .eq("content_block_id", blockId);

      if (error) throw error;
      setExistingAttachments(data || []);
    } catch (err) {
      console.error("Failed to load attachments:", err);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    try {
      const attachment = existingAttachments.find(a => a.id === attachmentId);
      if (!attachment) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('content-attachments')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("content_block_attachments")
        .delete()
        .eq("id", attachmentId);

      if (dbError) throw dbError;

      setExistingAttachments(existingAttachments.filter(a => a.id !== attachmentId));
      toast({ title: "Attachment removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const uploadNewAttachments = async (blockId: string): Promise<void> => {
    if (uploadedFiles.length === 0) return;

    try {
      for (const file of uploadedFiles) {
        const fileExt = file.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${blockId}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('content-attachments')
          .upload(filePath, file.file);

        if (uploadError) throw uploadError;

        // Save attachment record
        const { error: dbError } = await supabase
          .from("content_block_attachments")
          .insert({
            content_block_id: blockId,
            file_name: file.file.name,
            file_type: file.type,
            file_path: filePath,
            file_size_bytes: file.file.size,
            mime_type: file.file.type,
          });

        if (dbError) throw dbError;
      }

      setUploadedFiles([]);
      await loadExistingAttachments(blockId);
      toast({ title: "Files uploaded", description: `${uploadedFiles.length} file(s) attached successfully.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      throw err;
    }
  };

  const handleSaveWithAttachments = async () => {
    // For new blocks, inform user to save first
    if (!editingBlock && uploadedFiles.length > 0) {
      toast({
        title: "Create Block First",
        description: "Please save the block first, then add attachments.",
      });
    }

    try {
      // Save the block
      await onSave();

      // Then upload any new attachments (only if editing existing block)
      if (uploadedFiles.length > 0 && editingBlock) {
        await uploadNewAttachments(editingBlock.id);
      }
    } catch (err) {
      console.error("Error saving:", err);
    }
  };

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

          <div className="space-y-3 border-t pt-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Learning Materials</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Attach notes, images, code files, and documents for learners to access
              </p>
            </div>

            {!editingBlock ? (
              <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30 text-center">
                <p className="text-xs text-muted-foreground">
                  Save the block first to add attachments
                </p>
              </div>
            ) : (
              <FileUploadZone
                onFilesChange={handleFilesChange}
                files={uploadedFiles}
              />
            )}

            {existingAttachments.length > 0 && !isLoadingAttachments && (
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Attached files ({existingAttachments.length})
                </p>
                <div className="space-y-1">
                  {existingAttachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between text-xs p-2 bg-background rounded border border-border/50">
                      <div className="flex-1">
                        <p className="font-medium truncate">{attachment.file_name}</p>
                        <p className="text-muted-foreground capitalize">{attachment.file_type}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteExistingAttachment(attachment.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="hero" onClick={handleSaveWithAttachments} disabled={isSaving}>
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
