import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Prism from "prismjs";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-arduino";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";

interface CodeEditorProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

const languageMap: Record<string, string> = {
  cpp: "cpp",
  c: "c",
  arduino: "arduino",
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  ino: "arduino",
};

export const CodeEditor = ({ 
  code, 
  language = "cpp", 
  title,
  showLineNumbers = true 
}: CodeEditorProps) => {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const prismLanguage = languageMap[language.toLowerCase()] || "cpp";

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, prismLanguage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy code");
    }
  };

  const lines = code.split("\n");

  return (
    <div className="rounded-lg overflow-hidden border border-border bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          {title && (
            <span className="text-xs text-[#858585] ml-2">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#858585] uppercase">{language}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#858585] hover:text-white hover:bg-[#3c3c3c]"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto">
        <div className="flex min-w-full">
          {showLineNumbers && (
            <div className="flex-shrink-0 py-4 pr-4 pl-4 text-right select-none bg-[#1e1e1e] border-r border-[#3c3c3c]">
              {lines.map((_, i) => (
                <div key={i} className="text-xs text-[#858585] leading-6 font-mono">
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <pre className="flex-1 p-4 m-0 overflow-x-auto bg-[#1e1e1e]">
            <code
              ref={codeRef}
              className={`language-${prismLanguage} text-sm leading-6 font-mono`}
            >
              {code}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
