import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

export const ImageCropDialog = ({
  open,
  onClose,
  imageSrc,
  onCropComplete,
}: ImageCropDialogProps) => {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(() => {
    if (imgRef.current) {
      setDimensions({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, []);

  const handleCropDone = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropW = Math.round(completedCrop.width * scaleX);
    const cropH = Math.round(completedCrop.height * scaleY);

    canvas.width = cropW;
    canvas.height = cropH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
          onClose();
          // Reset for next use
          setCrop({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
          setCompletedCrop(null);
        }
      },
      "image/png",
      1
    );
  }, [completedCrop, onCropComplete, onClose]);

  // Compute cropped dimensions preview
  const croppedDims = completedCrop && imgRef.current
    ? {
        w: Math.round(completedCrop.width * (imgRef.current.naturalWidth / imgRef.current.width)),
        h: Math.round(completedCrop.height * (imgRef.current.naturalHeight / imgRef.current.height)),
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Crop Image</span>
            {dimensions && (
              <span className="text-xs font-normal text-muted-foreground">
                Original: {dimensions.w}×{dimensions.h}px
                {croppedDims && (
                  <> → Cropped: {croppedDims.w}×{croppedDims.h}px</>
                )}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center max-h-[60vh] overflow-auto bg-muted/20 rounded-md p-2">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              className="max-w-full"
              crossOrigin="anonymous"
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCropDone} disabled={!completedCrop}>
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
