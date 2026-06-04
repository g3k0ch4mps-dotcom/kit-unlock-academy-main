import { useState, useCallback } from "react";
import { Upload, X, FileText, Image, Code, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

// Point the PDF.js worker at the bundled copy so no CDN is needed
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }
  return pageTexts.join("\n\n");
}

interface UploadedFile {
  id: string;
  file: File;
  type: "document" | "image" | "code";
  preview?: string;
  content?: string;
  relativePath?: string;
}

interface FileUploadZoneProps {
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
}

const getFileType = (file: File): "document" | "image" | "code" => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'cpp', 'c', 'h', 'ino', 'json', 'xml', 'html', 'css', 'md', 'txt'];
  
  if (imageExtensions.includes(ext)) return "image";
  if (codeExtensions.includes(ext)) return "code";
  return "document";
};

const getFileIcon = (type: "document" | "image" | "code") => {
  switch (type) {
    case "image": return Image;
    case "code": return Code;
    default: return FileText;
  }
};

export const FileUploadZone = ({ onFilesChange, files }: FileUploadZoneProps) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);

  const processFile = async (file: File, relativePath?: string): Promise<UploadedFile> => {
    const type = getFileType(file);
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const uploadedFile: UploadedFile = { id, file, type, relativePath };

    if (type === "image") {
      uploadedFile.preview = URL.createObjectURL(file);
    }

    // Extract text from PDFs (fixes: PDFs previously sent no content to the AI)
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (isPdf) {
      try {
        setExtracting(file.name);
        uploadedFile.content = await extractPdfText(file);
        setExtracting(null);
      } catch (e) {
        setExtracting(null);
        console.error("PDF extraction failed:", e);
        toast({
          title: "PDF text extraction failed",
          description: `Could not read "${file.name}". Try converting it to a .txt file.`,
          variant: "destructive",
        });
      }
    } else if (type === "code" || file.type === "text/plain") {
      try {
        uploadedFile.content = await file.text();
      } catch (e) {
        console.error("Could not read file content:", e);
      }
    }

    return uploadedFile;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    const filePromises: Promise<UploadedFile>[] = [];
    
    // Handle folder drops using webkitGetAsEntry
    const processEntry = async (entry: FileSystemEntry, path = ""): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
        const relativePath = path ? `${path}/${file.name}` : file.name;
        filePromises.push(processFile(file, relativePath));
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries((entries) => resolve(entries));
        });
        const newPath = path ? `${path}/${entry.name}` : entry.name;
        await Promise.all(entries.map(e => processEntry(e, newPath)));
      }
    };
    
    if (items) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      await Promise.all(entries.map(e => processEntry(e)));
    } else {
      // Fallback for browsers without webkitGetAsEntry
      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach(file => filePromises.push(processFile(file)));
    }
    
    const processedFiles = await Promise.all(filePromises);
    onFilesChange([...files, ...processedFiles]);
  }, [files, onFilesChange]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const selectedFiles = Array.from(e.target.files);
    const processedFiles = await Promise.all(
      selectedFiles.map(file => {
        // webkitRelativePath contains folder path for folder uploads
        const relativePath = (file as any).webkitRelativePath || file.name;
        return processFile(file, relativePath);
      })
    );
    onFilesChange([...files, ...processedFiles]);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(files.filter(f => f.id !== id));
  };

  const openFileDialog = () => document.getElementById('file-upload-input')?.click();
  const openFolderDialog = () => document.getElementById('folder-upload-input')?.click();

  return (
    <div className="space-y-3">
      {extracting && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          Extracting text from <span className="font-medium truncate max-w-[200px]">{extracting}</span>…
        </div>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${isDragging 
            ? "border-primary bg-primary/10" 
            : "border-border hover:border-primary/50 hover:bg-muted/50"
          }
        `}
      >
        <input
          id="file-upload-input"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,.svg,.js,.ts,.jsx,.tsx,.py,.cpp,.c,.h,.ino,.json,.xml,.html,.css,.md"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          id="folder-upload-input"
          type="file"
          multiple
          // @ts-ignore - webkitdirectory is a valid attribute
          webkitdirectory=""
          directory=""
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Upload className={`h-8 w-8 mx-auto mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium mb-1">
          Drop files or folders here
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Documents (PDF, Word, TXT) • Images (JPG, PNG) • Code (Arduino, Python, C++)
        </p>
        
        <div className="flex gap-2 justify-center">
          <Button type="button" variant="outline" size="sm" onClick={openFileDialog}>
            <Upload className="h-4 w-4 mr-1" />
            Files
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openFolderDialog}>
            <Folder className="h-4 w-4 mr-1" />
            Folder
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Uploaded files ({files.length})
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                files.forEach(f => f.preview && URL.revokeObjectURL(f.preview));
                onFilesChange([]);
              }}
            >
              Clear all
            </Button>
          </div>
          <div className="grid gap-2 max-h-[200px] overflow-y-auto">
            {files.map((uploadedFile) => {
              const Icon = getFileIcon(uploadedFile.type);
              return (
                <div 
                  key={uploadedFile.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                >
                  {uploadedFile.type === "image" && uploadedFile.preview ? (
                    <img 
                      src={uploadedFile.preview} 
                      alt={uploadedFile.file.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadedFile.relativePath || uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {uploadedFile.type} • {(uploadedFile.file.size / 1024).toFixed(1)} KB
                      {uploadedFile.content
                        ? ` • ${uploadedFile.content.length.toLocaleString()} chars extracted`
                        : uploadedFile.type === "document"
                        ? " • no text extracted"
                        : ""}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(uploadedFile.id);
                    }}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
