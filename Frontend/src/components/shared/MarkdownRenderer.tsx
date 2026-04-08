/**
 * Shared Markdown renderer for AI chat messages.
 * Supports: headings, bold, italic, code, bullets, numbered lists, tables, horizontal rules, links.
 */
import React from "react";

function inlineFormat(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  // Match: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let m;
  while ((m = regex.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[2]) parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    else if (m[4]) parts.push(<code key={m.index} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{m[4]}</code>);
    else if (m[5] && m[6]) {
      parts.push(
        <a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80">{m[5]}</a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function parseTableRow(line: string): string[] | null {
  if (!line.trim().startsWith("|")) return null;
  return line.split("|").slice(1, -1);
}

export function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];
  let tableRows: string[][] = [];
  let tableHeader: string[] | null = null;
  let codeBlock: string[] | null = null;
  let codeLang = "";

  const flushList = () => {
    if (!listItems.length) return;
    const ordered = listItems[0].ordered;
    const Tag = ordered ? "ol" : "ul";
    elements.push(
      <Tag key={`list-${elements.length}`} className={`my-1.5 ml-4 space-y-0.5 ${ordered ? "list-decimal" : "list-disc"}`}>
        {listItems.map((li, i) => (
          <li key={i} className="text-sm leading-relaxed">{inlineFormat(li.text)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (!tableHeader && !tableRows.length) return;
    const headers = tableHeader || [];
    elements.push(
      <div key={`tbl-${elements.length}`} className="my-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          {headers.length > 0 && (
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">{inlineFormat(h.trim())}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-muted-foreground border-t border-border/50">{inlineFormat(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableHeader = null;
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block start/end
    if (line.trim().startsWith("```")) {
      if (codeBlock !== null) {
        // End code block
        elements.push(
          <div key={`code-${elements.length}`} className="my-2 rounded-lg border border-border bg-muted/30 overflow-x-auto">
            {codeLang && (
              <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground border-b border-border/50 bg-muted/50">{codeLang}</div>
            )}
            <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
              <code>{codeBlock.join("\n")}</code>
            </pre>
          </div>
        );
        codeBlock = null;
        codeLang = "";
      } else {
        // Start code block
        flushList();
        flushTable();
        codeBlock = [];
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (codeBlock !== null) {
      codeBlock.push(line);
      continue;
    }

    // Table row detection
    const tRow = parseTableRow(line);
    if (tRow !== null) {
      const isSeparator = tRow.every(c => /^[-: ]+$/.test(c));
      if (isSeparator) continue;
      if (tableHeader === null) {
        flushList();
        tableHeader = tRow;
      } else {
        tableRows.push(tRow);
      }
      continue;
    }
    flushTable();

    // Bullet points
    const bulletMatch = line.match(/^\s*[-•*]\s+(.*)/);
    if (bulletMatch) { listItems.push({ ordered: false, text: bulletMatch[1] }); continue; }
    // Numbered list
    const numMatch = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (numMatch) { listItems.push({ ordered: true, text: numMatch[1] }); continue; }
    flushList();

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { elements.push(<h4 key={i} className="mt-3 mb-1 text-sm font-bold text-foreground border-l-2 border-primary pl-2">{inlineFormat(h3[1])}</h4>); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { elements.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{inlineFormat(h2[1])}</h3>); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { elements.push(<h3 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{inlineFormat(h1[1])}</h3>); continue; }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) { elements.push(<hr key={i} className="my-2 border-border" />); continue; }

    // Empty line
    if (!line.trim()) { elements.push(<div key={i} className="h-2" />); continue; }

    // Normal paragraph
    elements.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
  }
  flushList();
  flushTable();
  return <div className="space-y-0.5">{elements}</div>;
}
