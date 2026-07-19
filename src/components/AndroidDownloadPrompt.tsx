import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";

// Public download endpoint — server route redirects to a fresh signed URL
// pointing at the APK in the private `app-downloads` Storage bucket.
const APK_URL = "/api/public/download-apk";
/**
 * Floating "Download app" prompt shown on the website.
 * - Hidden inside the Capacitor native shell (window.Capacitor is defined there).
 * - Always visible in browsers so returning visitors can download the APK.
 */
export function AndroidDownloadPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already running inside the native APK — don't prompt to download it.
    if ((window as any).Capacitor?.isNativePlatform?.()) return;

    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50"
      role="region"
      aria-label="Download CareCore Android app"
    >
      <a
        href={APK_URL}
        download="carecore.apk"
        className="group flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Download CareCore APK"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-foreground/15">
          <ArrowDown className="h-5 w-5 animate-bounce" />
        </span>
        <span className="pr-1">Download app</span>
      </a>
    </div>
  );
}
