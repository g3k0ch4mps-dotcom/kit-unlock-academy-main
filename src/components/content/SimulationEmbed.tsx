 import { ExternalLink } from "lucide-react";
 import { Button } from "@/components/ui/button";
 
 interface SimulationEmbedProps {
   url: string;
   title?: string;
 }
 
 export const SimulationEmbed = ({ url, title = "Circuit Simulation" }: SimulationEmbedProps) => {
   // Detect simulation platform and adjust URL if needed
   const getEmbedUrl = (inputUrl: string): string => {
     // Wokwi projects
     if (inputUrl.includes("wokwi.com/projects/")) {
       // Already an embed URL or regular URL
       return inputUrl.includes("/embed") ? inputUrl : inputUrl;
     }
     // Tinkercad circuits
     if (inputUrl.includes("tinkercad.com")) {
       // Add embed if not present
       if (!inputUrl.includes("/embed")) {
         return inputUrl.replace("/circuits/", "/embed/") + "?editbtn=1";
       }
       return inputUrl;
     }
     return inputUrl;
   };
 
   const embedUrl = getEmbedUrl(url);
   const isWokwi = url.includes("wokwi.com");
   const isTinkercad = url.includes("tinkercad.com");
 
   return (
     <div className="rounded-xl border border-border overflow-hidden bg-card">
       <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-destructive" />
           <div className="w-3 h-3 rounded-full bg-warning" />
           <div className="w-3 h-3 rounded-full bg-success" />
           <span className="ml-2 text-sm font-medium">{title}</span>
         </div>
         <div className="flex items-center gap-2">
           {isWokwi && (
             <span className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
               Wokwi
             </span>
           )}
           {isTinkercad && (
             <span className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
               Tinkercad
             </span>
           )}
           <Button variant="ghost" size="sm" asChild>
             <a href={url} target="_blank" rel="noopener noreferrer">
               <ExternalLink className="h-4 w-4" />
             </a>
           </Button>
         </div>
       </div>
       <div className="aspect-video bg-background">
         <iframe
           src={embedUrl}
           title={title}
           className="w-full h-full border-0"
           sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
           allow="accelerometer; autoplay; encrypted-media; gyroscope; fullscreen"
           allowFullScreen
         />
       </div>
       <div className="px-4 py-3 bg-muted/30 border-t border-border">
         <p className="text-xs text-muted-foreground">
           Run the simulation above to test your circuit without physical hardware.
           Click the play button to start.
         </p>
       </div>
     </div>
   );
 };
 
 export default SimulationEmbed;