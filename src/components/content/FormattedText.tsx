import React from "react";
import DOMPurify from "dompurify";

/**
 * Parses inline formatting: *italic*, UPPERCASE emphasis, `code`,
 * and renders them as proper HTML elements.
 */
const renderInlineFormatting = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  // Match (order matters): `code`, **bold**, *italic*
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // inline code
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-foreground">
          {match[1].slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      // bold (**text**)
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2].slice(2, -2)}</strong>);
    } else if (match[3]) {
      // italic (*text*)
      parts.push(<em key={match.index}>{match[3].slice(1, -1)}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

interface FormattedTextProps {
  content: string;
  className?: string;
}

/**
 * Renders content with proper formatting:
 * - Blank lines become paragraph breaks
 * - Lines starting with - or • become bullet lists
 * - Lines starting with numbers become ordered lists
 * - ### headers rendered as h4
 * - Inline code, italic support
 * - Links rendered as clickable
 */
export const FormattedText = ({ content, className = "" }: FormattedTextProps) => {
  if (!content) return null;

  // Check if content is HTML (from rich text editor)
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={`prose prose-sm max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
      />
    );
  }

  // Legacy plain-text formatting below
  // Strip leading # from lines that start with # (session header cleanup)
  const cleanedContent = content.replace(/^#\s+/gm, '');
  const lines = cleanedContent.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const headerMatch = trimmed.match(/^(#{2,4})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      if (level === 2) {
        elements.push(<h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-foreground">{text}</h3>);
      } else {
        elements.push(<h4 key={i} className="text-base font-semibold mt-3 mb-1.5 text-foreground">{text}</h4>);
      }
      i++;
      continue;
    }

    // A bullet marker (- • *) must be followed by whitespace. This is markdown-
    // correct AND prevents a bold line like "**Note:**" (which starts with *)
    // from being mistaken for a bullet.
    const bulletRe = /^[-•*]\s+/;
    if (bulletRe.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (bulletRe.test(lt)) {
          const itemText = lt.replace(bulletRe, '');
          listItems.push(
            <li key={i} className="ml-4 mb-1 text-foreground list-disc">
              {renderInlineFormatting(itemText)}
            </li>
          );
          i++;
        } else if (!lt) {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(<ul key={`ul-${i}`} className="my-2 space-y-0.5">{listItems}</ul>);
      continue;
    }

    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length) {
        const lt = lines[i].trim();
        if (/^\d+[\.\)]\s/.test(lt)) {
          const itemText = lt.replace(/^\d+[\.\)]\s*/, '');
          listItems.push(
            <li key={i} className="ml-4 mb-2 text-foreground">
              {renderInlineFormatting(itemText)}
            </li>
          );
          i++;
        } else if (!lt) {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(<ol key={`ol-${i}`} className="my-2 list-decimal space-y-1">{listItems}</ol>);
      continue;
    }

    const linkMatch = trimmed.match(/(https?:\/\/[^\s]+)/);

    elements.push(
      <p key={i} className="mb-2.5 text-foreground leading-relaxed text-justify">
        {linkMatch
          ? renderInlineFormatting(trimmed.replace(linkMatch[1], '')).concat(
              <a key="link" href={linkMatch[1]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">
                {linkMatch[1]}
              </a>
            )
          : renderInlineFormatting(trimmed)
        }
      </p>
    );
    i++;
  }

  return <div className={`prose prose-sm max-w-none ${className}`}>{elements}</div>;
};

export default FormattedText;
