import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Runs before paint to avoid light/dark flash on load. */
export function ThemeInitScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#1c1c1c":"#fafaf9");}catch(e){}})();`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
