import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Kit {
  id: number;
  name: string;
  description: string;
  category: "robotics" | "iot";
  sessions: number;
  image: string;
}

interface FormData {
  name: string;
  description: string;
  category: "robotics" | "iot";
  sessions: number;
  image: string;
  difficulty_level: "beginner" | "intermediate" | "advanced";
  createProgram: boolean;
}

interface ImageUploadProps {
  currentImage: string;
  onImageChange: (url: string) => void;
}

const ImageUpload = ({ currentImage, onImageChange }: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('kit-images')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('kit-images')
        .getPublicUrl(fileName);

      setPreviewUrl(urlData.publicUrl);
      onImageChange(urlData.publicUrl);
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl("");
    onImageChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      <Label>Kit Image</Label>
      <div className="space-y-3">
        {previewUrl ? (
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img 
              src={previewUrl} 
              alt="Kit preview" 
              className="w-full h-40 object-cover"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={handleRemoveImage}
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div 
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload an image
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 5MB
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Paste image URL..."
            value={previewUrl}
            onChange={(e) => {
              setPreviewUrl(e.target.value);
              onImageChange(e.target.value);
            }}
          />
          <Button 
            type="button"
            variant="outline" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label="Upload image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface AddKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  onAdd: () => void;
}

export const AddKitDialog = ({ 
  open, 
  onOpenChange, 
  formData, 
  setFormData, 
  onAdd 
}: AddKitDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add New Kit</DialogTitle>
        <DialogDescription>
          Create a new hardware kit with its details and content.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Kit Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter kit name"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the kit"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value: "robotics" | "iot") => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="robotics">Robotics</SelectItem>
                <SelectItem value="iot">IoT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
             <Label htmlFor="difficulty">Difficulty</Label>
             <Select 
               value={formData.difficulty_level || "beginner"} 
               onValueChange={(value: "beginner" | "intermediate" | "advanced") => setFormData({ ...formData, difficulty_level: value })}
             >
               <SelectTrigger>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="beginner">Beginner</SelectItem>
                 <SelectItem value="intermediate">Intermediate</SelectItem>
                 <SelectItem value="advanced">Advanced</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>
         <div className="grid grid-cols-2 gap-4">
           <div className="grid gap-2">
             <Label htmlFor="sessions">Total Sessions</Label>
            <Input
              id="sessions"
              type="number"
              value={formData.sessions}
              onChange={(e) => setFormData({ ...formData, sessions: parseInt(e.target.value) || 0 })}
              min={1}
            />
          </div>
        </div>
        <ImageUpload
          currentImage={formData.image}
          onImageChange={(url) => setFormData({ ...formData, image: url })}
        />
        
        {/* Auto-create program toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="create-program" className="text-base">Auto-create Program</Label>
            <p className="text-sm text-muted-foreground">
              Automatically create a matching program for this kit
            </p>
          </div>
          <Switch
            id="create-program"
            checked={formData.createProgram || false}
            onCheckedChange={(checked) => setFormData({ ...formData, createProgram: checked })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="hero" onClick={onAdd} disabled={!formData.name}>
          Add Kit
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface EditKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  onEdit: () => void;
}

export const EditKitDialog = ({ 
  open, 
  onOpenChange, 
  formData, 
  setFormData, 
  onEdit 
}: EditKitDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Kit</DialogTitle>
        <DialogDescription>
          Update the kit details and content.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-name">Kit Name</Label>
          <Input
            id="edit-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value: "robotics" | "iot") => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="robotics">Robotics</SelectItem>
                <SelectItem value="iot">IoT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-sessions">Sessions</Label>
            <Input
              id="edit-sessions"
              type="number"
              value={formData.sessions}
              onChange={(e) => setFormData({ ...formData, sessions: parseInt(e.target.value) || 0 })}
              min={1}
            />
          </div>
        </div>
        <ImageUpload
          currentImage={formData.image}
          onImageChange={(url) => setFormData({ ...formData, image: url })}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="hero" onClick={onEdit}>
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface DeleteKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitName?: string;
  onDelete: () => void;
  errorMessage?: string | null;
}

export const DeleteKitDialog = ({ 
  open, 
  onOpenChange, 
  kitName, 
  onDelete,
  errorMessage
}: DeleteKitDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>Delete Kit</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete "{kitName}"? You can undo this within 24 hours.
        </DialogDescription>
      </DialogHeader>
      {errorMessage && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={!!errorMessage}>
          Delete Kit
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
