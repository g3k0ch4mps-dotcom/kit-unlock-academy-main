import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface Kit {
  id: number;
  name: string;
  description: string;
  category: "robotics" | "iot";
  sessions: number;
  image: string;
}

interface KitCardProps {
  kit: Kit;
  variant?: "default" | "compact";
  onEdit: (kit: Kit) => void;
  onDelete: (kit: Kit) => void;
}

export const KitCard = ({ kit, variant = "default", onEdit, onDelete }: KitCardProps) => {
  const isCompact = variant === "compact";
  
  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border">
      <div className="aspect-video overflow-hidden relative group">
        <img 
          src={kit.image} 
          alt={kit.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(kit)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(kit)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <h3 className={`font-semibold mb-1 ${isCompact ? "text-sm" : ""}`}>{kit.name}</h3>
        <p className={`text-muted-foreground mb-3 ${isCompact ? "text-xs" : "text-sm"}`}>
          {kit.description}
        </p>
        <div className="flex items-center justify-between">
          <span className={`text-primary font-medium ${isCompact ? "text-xs" : "text-sm"}`}>
            {kit.sessions} sessions
          </span>
          <div className={`flex ${isCompact ? "gap-1" : "gap-2"}`}>
            <Button 
              size="sm" 
              variant="ghost" 
              className={isCompact ? "h-8 w-8 p-0" : ""}
              onClick={() => onEdit(kit)}
            >
              <Pencil className={isCompact ? "h-3 w-3" : "h-4 w-4"} />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className={`text-destructive ${isCompact ? "h-8 w-8 p-0" : ""}`}
              onClick={() => onDelete(kit)}
            >
              <Trash2 className={isCompact ? "h-3 w-3" : "h-4 w-4"} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
