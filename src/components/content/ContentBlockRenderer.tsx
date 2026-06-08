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
          <div className="rounded-xl border-l-4 border-destructive bg-destructive/5 px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-destructive flex-shrink-0" />
              <h4 className="font-semibold text-destructive">
                {block.title || "Problem Statement"}
              </h4>
            </div>
            <ProtectedContent>
              <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );

      case "solution":
        return (
          <div className="rounded-xl border-l-4 border-success bg-success/5 px-5 py-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-success flex-shrink-0" />
              <h4 className="font-semibold text-success">
                {block.title || "Proposed Solution"}
              </h4>
            </div>
            <ProtectedContent>
              <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );

      case "components":
        return (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Cpu className="h-4 w-4 text-primary" />
              </div>
              <h4 className="font-semibold text-base text-primary">
                {block.title || "Components Required"}
              </h4>
            </div>
            <ProtectedContent>
              <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );

      case "circuit_diagram":
      case "diagram":
        return (
          <figure className="rounded-xl overflow-hidden border border-border shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900 border-b border-zinc-700">
              <CircuitBoard className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-zinc-100">
                {block.title || "Wiring Diagram"}
              </span>
            </div>
            {block.image_url && (
              <div className="overflow-hidden bg-zinc-950">
                <img
                  src={block.image_url}
                  alt={block.title || "Circuit diagram"}
                  className="w-full object-contain transition-transform duration-300 ease-out hover:scale-105 cursor-zoom-in"
                  style={{ maxHeight: "480px" }}
                />
              </div>
            )}
            {block.content && (
              <figcaption className="px-4 py-3 bg-zinc-900 border-t border-zinc-700 text-sm text-zinc-300">
                <ProtectedContent>
                  <FormattedText content={block.content} className="text-zinc-300" />
                </ProtectedContent>
              </figcaption>
            )}
          </figure>
        );

      case "code":
        return (
          <div className="space-y-2">
            {block.title && (
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{block.title}</span>
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
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h4 className="font-semibold text-base">
                {block.title || "Review Questions"}
              </h4>
            </div>
            <ProtectedContent>
              <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );

      case "feedback":
        return (
          <div className="rounded-xl border border-border bg-muted/20 p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h4 className="font-semibold text-base">
                {block.title || "Session Feedback"}
              </h4>
            </div>
            <ProtectedContent>
              <FormattedText content={block.content || ""} className="text-foreground" />
            </ProtectedContent>
          </div>
        );

      case "safety_note":
        return (
          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <ProtectedContent>
              <div className="text-sm text-foreground">
                <span className="font-semibold text-warning">Safety: </span>
                <FormattedText content={block.content || ""} />
              </div>
            </ProtectedContent>
          </div>
        );

      case "tip":
        return (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <ProtectedContent>
              <div className="text-sm text-foreground">
                <span className="font-semibold text-primary">Tip: </span>
                <FormattedText content={block.content || ""} />
              </div>
            </ProtectedContent>
          </div>
        );

      case "image":
        return (
          <figure className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
            {block.title && (
              <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
                <span className="text-sm font-medium text-foreground">{block.title}</span>
              </div>
            )}
            {block.image_url && (
              <div className="overflow-hidden bg-white">
                <img
                  src={block.image_url}
                  alt={block.title || "Content image"}
                  className="w-full object-contain transition-transform duration-300 ease-out hover:scale-105 cursor-zoom-in"
                  style={{ maxHeight: "480px" }}
                />
              </div>
            )}
            {block.content && (
              <figcaption className="px-4 py-3 text-sm text-muted-foreground bg-muted/30 border-t border-border">
                <ProtectedContent>
                  <FormattedText content={block.content} />
                </ProtectedContent>
              </figcaption>
            )}
          </figure>
        );

      case "text":
      default:
        return (
          <div className="space-y-3">
            {block.title && (
              <h3 className="text-xl font-bold text-foreground border-l-4 border-primary pl-3">
                {block.title}
              </h3>
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
