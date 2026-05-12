import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { useToast } from "@/hooks/use-toast";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  ImageIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  Minus,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({
  content,
  onChange,
  placeholder = "Start typing or paste content with images...",
  className = "",
}: RichTextEditorProps) => {
  const { toast } = useToast();

  // Convert any image file/blob to a web-safe format (PNG) if needed
  const normalizeImage = useCallback(async (file: File | Blob): Promise<Blob> => {
    const webSafeTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    if (webSafeTypes.includes(file.type)) return file;

    // Convert non-standard formats (BMP, TIFF, HEIC, etc.) via canvas
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas context failed"));
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
            "image/png",
            1
          );
        };
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadImage = useCallback(
    async (file: File | Blob): Promise<string | null> => {
      try {
        const normalized = await normalizeImage(file);
        const fileExt = file instanceof File
          ? (file.name.split(".").pop() || "png")
          : "png";
        const ext = normalized.type === "image/png" ? "png" : fileExt;
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `content-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("kit-images")
          .upload(filePath, normalized, {
            contentType: normalized.type || "image/png",
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("kit-images")
          .getPublicUrl(filePath);

        return urlData.publicUrl;
      } catch (err: any) {
        toast({
          title: "Image Upload Failed",
          description: err.message,
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, normalizeImage]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: null,
              renderHTML: (attrs) =>
                attrs.width ? { style: `width: ${attrs.width}` } : {},
              parseHTML: (el) => el.style.width || null,
            },
            "data-align": {
              default: "center",
              renderHTML: (attrs) => ({ "data-align": attrs["data-align"] }),
              parseHTML: (el) => el.getAttribute("data-align") || "center",
            },
          };
        },
      }).configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[250px] p-4 focus:outline-none text-foreground",
      },
      handleKeyDown: (_view, event) => {
        // Keyboard shortcuts for formatting
        if (event.ctrlKey || event.metaKey) {
          if (event.shiftKey) {
            switch (event.key) {
              case "1":
                editor?.chain().focus().toggleHeading({ level: 2 }).run();
                return true;
              case "2":
                editor?.chain().focus().toggleHeading({ level: 3 }).run();
                return true;
              case "8":
                editor?.chain().focus().toggleBulletList().run();
                return true;
              case "9":
                editor?.chain().focus().toggleOrderedList().run();
                return true;
              case "e":
              case "E":
                editor?.chain().focus().toggleCodeBlock().run();
                return true;
              case "b":
              case "B":
                editor?.chain().focus().toggleBlockquote().run();
                return true;
            }
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        // 1. Handle direct image files from clipboard (screenshots, copy-paste images)
        const items = Array.from(clipboard.items);
        const imageItems = items.filter((item) => item.type.startsWith("image/"));
        if (imageItems.length > 0) {
          event.preventDefault();
          imageItems.forEach((item) => {
            const file = item.getAsFile();
            if (file) {
              uploadImage(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
            }
          });
          return true;
        }

        // 2. Handle HTML paste with embedded base64 images (from Word, PDFs, etc.)
        const html = clipboard.getData("text/html");
        if (html) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          let match;
          const base64Sources: string[] = [];
          while ((match = imgRegex.exec(html)) !== null) {
            if (match[1].startsWith("data:image")) {
              base64Sources.push(match[1]);
            }
          }

          if (base64Sources.length > 0) {
            event.preventDefault();

            // Convert base64 data URIs to blobs and upload
            base64Sources.forEach(async (dataUri) => {
              try {
                const res = await fetch(dataUri);
                const blob = await res.blob();
                const url = await uploadImage(blob);
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              } catch (err) {
                console.error("Failed to process pasted base64 image:", err);
              }
            });

            // Also insert any non-image HTML content
            const cleanedHtml = html.replace(/<img[^>]+src=["']data:image[^"']*["'][^>]*>/gi, "");
            if (cleanedHtml.replace(/<[^>]*>/g, "").trim()) {
              editor?.commands.insertContent(cleanedHtml);
            }
            return true;
          }
        }

        // 3. Handle pasted files (e.g., from file manager)
        const files = clipboard.files;
        if (files && files.length > 0) {
          const imageFiles = Array.from(files).filter((f) =>
            f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg|heic)$/i.test(f.name)
          );
          if (imageFiles.length > 0) {
            event.preventDefault();
            imageFiles.forEach((file) => {
              uploadImage(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
            });
            return true;
          }
        }

        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter(
          (f) => f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg|heic)$/i.test(f.name)
        );

        if (imageFiles.length > 0) {
          event.preventDefault();
          imageFiles.forEach((file) => {
            uploadImage(file).then((url) => {
              if (url && editor) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });
          });
          return true;
        }
        return false;
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !editor) return;
      const url = await uploadImage(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  }, [editor, uploadImage]);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${isActive ? "bg-muted text-primary" : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div data-editor-wrapper className={`relative border border-input rounded-md overflow-hidden bg-background ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={handleImageUpload} title="Insert Image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
      <ImageBubbleMenu editor={editor} />

    </div>
  );
};

export default RichTextEditor;
