"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

const script = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored === 'dark'
      || ((stored === 'system' || !stored)
          && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

// React 19 tidak menjalankan <script> yang dirender komponen di client,
// dan malah memunculkan error. Skrip ini disisipkan ke akhir <head> saat
// SSR, di luar pohon React, supaya browser menjalankannya sebelum paint.
export function ThemeScript() {
  const sudahDisisipkan = useRef(false);

  useServerInsertedHTML(() => {
    if (sudahDisisipkan.current) return null;
    sudahDisisipkan.current = true;
    return <script dangerouslySetInnerHTML={{ __html: script }} />;
  });

  return null;
}
