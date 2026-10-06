import * as React from "react";

/** Tangkap gambar yang di-paste (Ctrl+V) dari clipboard, di mana pun fokusnya ada di halaman. */
export function usePasteImages(onFiles: (files: File[]) => void) {
  const handlerRef = React.useRef(onFiles);
  handlerRef.current = onFiles;

  React.useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            files.push(
              new File([file], file.name || `paste-${Date.now()}.png`, { type: file.type })
            );
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handlerRef.current(files);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);
}
