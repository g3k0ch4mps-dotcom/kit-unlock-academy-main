import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportSessionToPdf } from "@/utils/pdfExport";

interface ContentBlock {
  id: string;
  block_type: string;
  title?: string | null;
  content?: string | null;
  image_url?: string | null;
  code_language?: string | null;
  block_order: number;
}

interface PdfDownloadButtonProps {
  sessionTitle: string;
  programTitle: string;
  sessionOrder: number;
  contentBlocks: ContentBlock[];
  userName?: string;
  userId?: string;
}

export const PdfDownloadButton = ({
  sessionTitle,
  programTitle,
  sessionOrder,
  contentBlocks,
  userName,
  userId,
}: PdfDownloadButtonProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (contentBlocks.length === 0) {
      toast.error("No content available to download");
      return;
    }

    setIsGenerating(true);
    try {
      await exportSessionToPdf({
        sessionTitle,
        programTitle,
        sessionOrder,
        contentBlocks,
        userName,
        userId,
      });
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={isGenerating || contentBlocks.length === 0}
      className="gap-2"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isGenerating ? "Generating PDF..." : "Download PDF"}
    </Button>
  );
};

export default PdfDownloadButton;
