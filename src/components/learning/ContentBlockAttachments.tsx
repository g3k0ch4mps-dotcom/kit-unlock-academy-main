import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Code, Image as ImageIcon, Loader2 } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_type: "document" | "image" | "code";
  file_path: string;
  file_size_bytes?: number;
}

interface ContentBlockAttachmentsProps {
  blockId: string;
}

const getFileIcon = (type: "document" | "image" | "code") => {
  switch (type) {
    case "image": return ImageIcon;
    case "code": return Code;
    default: return FileText;
  }
};

export const ContentBlockAttachments = ({ blockId }: ContentBlockAttachmentsProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadAttachments();
  }, [blockId]);

  const loadAttachments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("content_block_attachments")
        .select("*")
        .eq("content_block_id", blockId);

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.error("Failed to load attachments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async (attachment: Attachment) => {
    try {
      setDownloadingId(attachment.id);
      const { data, error } = await supabase.storage
        .from('content-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 bg-muted/30 rounded-lg p-4 border border-border/50">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Learning Materials</h4>
        <Badge variant="outline" className="text-xs">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="space-y-2">
        {attachments.map((attachment) => {
          const Icon = getFileIcon(attachment.file_type);
          const sizeMB = attachment.file_size_bytes ? (attachment.file_size_bytes / 1024 / 1024).toFixed(2) : '0';

          return (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={attachment.file_name}>
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {attachment.file_type} • {sizeMB} MB
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="flex-shrink-0 ml-2"
                onClick={() => downloadFile(attachment)}
                disabled={downloadingId === attachment.id}
              >
                {downloadingId === attachment.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
