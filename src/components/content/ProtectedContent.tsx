import { useEffect, useRef, ReactNode } from "react";

interface ProtectedContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component that prevents text selection and copying of its contents.
 * Use this for educational content that should not be easily copied.
 */
export const ProtectedContent = ({ children, className = "" }: ProtectedContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      return false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    container.addEventListener("copy", handleCopy);
    container.addEventListener("contextmenu", handleContextMenu);
    container.addEventListener("selectstart", handleSelectStart);

    return () => {
      container.removeEventListener("copy", handleCopy);
      container.removeEventListener("contextmenu", handleContextMenu);
      container.removeEventListener("selectstart", handleSelectStart);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`select-none ${className}`}
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        userSelect: "none",
      }}
    >
      {children}
    </div>
  );
};

export default ProtectedContent;
