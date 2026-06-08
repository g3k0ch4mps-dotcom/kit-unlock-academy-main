import { 
  AlertTriangle, 
  Lightbulb, 
  HelpCircle, 
  MessageSquare,
  Cpu,
  Zap,
  Target,
  CircuitBoard,
  Code2
} from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import { ProtectedContent } from "./ProtectedContent";
import { FormattedText } from "./FormattedText";

interface ContentBlock {
  id: string;
  block_type: string;
  title?: string;
  content?: string;
  image_url?: string;
  code_language?: string;
  block_order: number;
  metadata?: Record<string, any>;
}

interface ContentBlockRendererProps {
  block: ContentBlock;
}

export const ContentBlockRenderer = ({ block }: ContentBlockRendererProps) => {
  const renderBlock = () => {
    switch (block.block_type) {
      case "problem":
        return (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <Target className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2 text-destructive">
                  {block.title || "Problem Statement"}
                </h4>
                <ProtectedContent>
                  <FormattedText content={block.content || ""} className="text-foreground" />
                </ProtectedContent>
              </div>
            </div>
          </div>
        );

      case "solution":
        return (
          <div className="rounded-lg border border-success/30 bg-success/5 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2 text-success">
                  {block.title || "Proposed Solution"}
                </h4>
                <ProtectedContent>
                <FormattedText content={block.content || ""} className="text-foreground" />
                </ProtectedContent>
              </div>
            </div>
          </div>
        );

      case "components":
        return (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-3 text-primary">
                  {block.title || "Components Required"}
                </h4>
                <ProtectedContent>
                  <FormattedText content={block.content || ""} className="text-foreground" />
                </ProtectedContent>
              </div>
            </div>
          </div>
        );

      case "circuit_diagram":
      case "diagram":
        return (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <CircuitBoard className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-lg">
                {block.title || "Circuit Diagram"}
              </h4>
            </div>
            {block.image_url && (
              <div className="rounded-lg overflow-hidden border border-border mb-4">
                <img 
                  src={block.image_url} 
                  alt={block.title || "Circuit diagram"} 
                  className="w-full object-contain max-h-[400px]"
                />
              </div>
            )}
            {block.content && (
              <ProtectedContent>
                <FormattedText content={block.content} className="text-foreground" />
              </ProtectedContent>
            )}
          </div>
        );

      case "code":
        return (
          <div className="space-y-3">
            {block.title && (
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-lg">{block.title}</h4>
              </div>
            )}
            <CodeEditor 
              code={block.content || ""} 
              language={block.code_language || "cpp"}
              title={block.title}
            />
          </div>
        );

      case "questions":
        return (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-accent/10">
                <HelpCircle className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-3">
                  {block.title || "Review Questions"}
                </h4>
                <ProtectedContent>
                  <FormattedText content={block.content || ""} className="text-foreground" />
                </ProtectedContent>
              </div>
            </div>
          </div>
        );

      case "feedback":
        return (
          <div className="rounded-lg border border-border bg-muted/30 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2">
                  {block.title || "Session Feedback"}
                </h4>
                <ProtectedContent>
                  <FormattedText content={block.content || ""} className="text-foreground" />
                </ProtectedContent>
              </div>
            </div>
          </div>
        );

      case "safety_note":
        return (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <ProtectedContent>
                <div className="text-sm text-foreground">
                  <span className="font-semibold text-warning">Safety Note: </span>
                  <FormattedText content={block.content || ""} />
                </div>
              </ProtectedContent>
            </div>
          </div>
        );

      case "tip":
        return (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-accent-foreground flex-shrink-0 mt-0.5" />
              <ProtectedContent>
                <div className="text-sm text-foreground">
                  <span className="font-semibold text-accent-foreground">Tip: </span>
                  <FormattedText content={block.content || ""} />
                </div>
              </ProtectedContent>
            </div>
          </div>
        );

      case "image":
        return (
          <div className="rounded-lg overflow-hidden border border-border">
            {block.title && (
              <div className="px-4 py-2 bg-muted border-b border-border">
                <span className="text-sm font-medium">{block.title}</span>
              </div>
            )}
            {block.image_url && (
              <img 
                src={block.image_url} 
                alt={block.title || "Content image"} 
                className="w-full object-contain"
              />
            )}
            {block.content && (
              <ProtectedContent className="p-4 text-sm text-muted-foreground">
                <FormattedText content={block.content} />
              </ProtectedContent>
            )}
          </div>
        );

      case "text":
      default:
        return (
          <div className="space-y-3">
            {block.title && (
              <h4 className="font-semibold text-lg">{block.title}</h4>
            )}
            <ProtectedContent>
                <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );
    }
  };

  return (
    <div className="mb-6">
      {renderBlock()}
    </div>
  );
};

export default ContentBlockRenderer;
