import { useState } from "react";
import { AlertTriangle, Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
};

/** Derive the file extension from a URL (ignores query strings). */
function getExtension(url: string): string {
  return (url.split("?")[0].split(".").pop() ?? "").toLowerCase();
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"]);

export function PdfViewerDialog({ open, onClose, url, title }: Props) {
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ext = getExtension(url);
  const isImage = IMAGE_EXTS.has(ext);

  // Reset state whenever the dialog opens with a new URL
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setLoadError(false);
      setLoaded(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex flex-row items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="flex-1 text-sm font-semibold truncate">{title}</DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <a
              href={url}
              download={`${title}.${ext || "file"}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary transition-colors"
              title="Download"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative bg-muted/20">
          {/* Error state */}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive/60" />
              <p className="text-sm font-medium text-foreground">Could not load document</p>
              <p className="text-xs text-muted-foreground">The file may have been moved or deleted.</p>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="outline" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in browser
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={url} download={`${title}.${ext || "file"}`}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Image viewer */}
          {isImage && !loadError && (
            <div className="h-full w-full overflow-auto flex items-center justify-center p-4">
              <img
                src={url}
                alt={title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                onLoad={() => setLoaded(true)}
                onError={() => setLoadError(true)}
              />
            </div>
          )}

          {/* PDF / other document viewer */}
          {!isImage && !loadError && (
            <iframe
              key={url}
              src={url}
              title={title}
              className="w-full h-full border-0"
              onLoad={() => setLoaded(true)}
              onError={() => setLoadError(true)}
            />
          )}

          {/* Loading shimmer — shown until content loads */}
          {!loaded && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30 pointer-events-none">
              <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
