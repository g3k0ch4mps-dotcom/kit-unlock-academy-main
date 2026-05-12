import { useState, useCallback, useEffect, useRef } from "react";
import { type Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageCropDialog } from "./ImageCropDialog";
import {
  Crop,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

interface ImageBubbleMenuProps {
  editor: Editor;
}

const SIZE_OPTIONS = [
  { label: "S", value: "25%", title: "Small (25%)" },
  { label: "M", value: "50%", title: "Medium (50%)" },
  { label: "L", value: "75%", title: "Large (75%)" },
  { label: "Full", value: "100%", title: "Full width" },
];

export const ImageBubbleMenu = ({ editor }: ImageBubbleMenuProps) => {
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getSelectedImageNode = useCallback(() => {
    const { state } = editor;
    const { from } = state.selection;
    const node = state.doc.nodeAt(from);
    return node?.type.name === "image" ? node : null;
  }, [editor]);

  const updateImageAttr = useCallback(
    (attrs: Record<string, any>) => {
      const { state, view } = editor;
      const { from } = state.selection;
      const node = state.doc.nodeAt(from);
      if (!node || node.type.name !== "image") return;

      const tr = state.tr.setNodeMarkup(from, undefined, {
        ...node.attrs,
        ...attrs,
      });
      view.dispatch(tr);
    },
    [editor]
  );

  useEffect(() => {
    const updateMenu = () => {
      const node = getSelectedImageNode();
      if (!node) {
        setVisible(false);
        return;
      }

      setVisible(true);

      // Find the actual selected image DOM element for precise positioning
      const { from } = editor.state.selection;
      const domNode = editor.view.nodeDOM(from);
      const wrapperEl = editor.view.dom.closest("[data-editor-wrapper]");

      if (domNode instanceof HTMLElement && wrapperEl) {
        const imgEl = domNode.tagName === "IMG" ? domNode : domNode.querySelector("img");
        if (imgEl) {
          const imgRect = imgEl.getBoundingClientRect();
          const wrapperRect = wrapperEl.getBoundingClientRect();
          setPosition({
            top: imgRect.top - wrapperRect.top - 44,
            left: imgRect.left - wrapperRect.left + imgRect.width / 2,
          });
          return;
        }
      }

      // Fallback to coordsAtPos
      const coords = editor.view.coordsAtPos(from);
      if (wrapperEl) {
        const wrapperRect = wrapperEl.getBoundingClientRect();
        setPosition({
          top: coords.top - wrapperRect.top - 44,
          left: coords.left - wrapperRect.left,
        });
      }
    };

    editor.on("selectionUpdate", updateMenu);
    editor.on("transaction", updateMenu);
    return () => {
      editor.off("selectionUpdate", updateMenu);
      editor.off("transaction", updateMenu);
    };
  }, [editor, getSelectedImageNode]);

  const handleResize = (width: string) => updateImageAttr({ width });
  const handleAlign = (align: string) => updateImageAttr({ "data-align": align });

  const handleCropClick = () => {
    const node = getSelectedImageNode();
    if (node?.attrs.src) {
      setCropSrc(node.attrs.src);
      setCropOpen(true);
    }
  };

  const handleCropComplete = useCallback(
    async (blob: Blob) => {
      try {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const filePath = `content-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("kit-images")
          .upload(filePath, blob);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("kit-images")
          .getPublicUrl(filePath);

        // Get dimensions from the blob for metadata
        const bitmapImg = await createImageBitmap(blob);
        const newWidth = bitmapImg.width;
        const newHeight = bitmapImg.height;
        bitmapImg.close();

        updateImageAttr({
          src: urlData.publicUrl,
          alt: `Cropped image (${newWidth}×${newHeight})`,
        });

        toast({ title: `Image cropped (${newWidth}×${newHeight}) and saved` });
      } catch (err: any) {
        toast({
          title: "Crop upload failed",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [updateImageAttr, toast]
  );

  const currentNode = getSelectedImageNode();
  const currentAlign = currentNode?.attrs["data-align"] || "center";

  return (
    <>
      {visible && currentNode && (
        <div
          ref={menuRef}
          className="absolute z-50 flex items-center gap-1 rounded-lg border border-border bg-background p-1 shadow-lg -translate-x-1/2"
          style={{ top: Math.max(0, position.top), left: position.left }}
        >
          {SIZE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs ${
                currentNode.attrs.width === opt.value ? "bg-muted text-primary" : ""
              }`}
              onClick={() => handleResize(opt.value)}
              title={opt.title}
            >
              {opt.label}
            </Button>
          ))}

          <div className="w-px h-5 bg-border mx-0.5" />

          {[
            { align: "left", Icon: AlignLeft },
            { align: "center", Icon: AlignCenter },
            { align: "right", Icon: AlignRight },
          ].map(({ align, Icon }) => (
            <Button
              key={align}
              type="button"
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${currentAlign === align ? "bg-muted text-primary" : ""}`}
              onClick={() => handleAlign(align)}
              title={`Align ${align}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}

          <div className="w-px h-5 bg-border mx-0.5" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleCropClick}
            title="Crop image"
          >
            <Crop className="h-3.5 w-3.5" />
            Crop
          </Button>
        </div>
      )}

      <ImageCropDialog
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        imageSrc={cropSrc}
        onCropComplete={handleCropComplete}
      />
    </>
  );
};
