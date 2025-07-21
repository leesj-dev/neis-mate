import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { SettingsModal } from "@/components/settings-modal";
import { GoogleAuth } from "@/components/google-auth";

export function Header() {
  const { user, loadMemosFromDrive, googleDriveLoaded } = useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load memos from Google Drive when user logs in (only once)
  useEffect(() => {
    if (user?.isLoggedIn && user.googleId && !googleDriveLoaded) {
      console.log("Header: Loading memos from Google Drive for the first time");
      loadMemosFromDrive().catch(error => {
        console.error("Failed to load memos from Drive:", error);
      });
    }
  }, [user?.isLoggedIn, user?.googleId, googleDriveLoaded, loadMemosFromDrive]);

  if (!user?.isLoggedIn) {
    return (
      <header className="h-14 border-b bg-card flex items-center justify-between pl-6 pr-3">
        <h1 className="font-semibold text-xl">NEIS Mate</h1>
        <div className="flex items-center gap-2">
          <GoogleAuth />
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="h-14 border-b bg-card flex items-center justify-between pl-6 pr-3">
        <h1 className="font-semibold text-xl">NEIS Mate</h1>

        <div className="flex items-center gap-2">
          <GoogleAuth onSettingsClick={() => setIsSettingsOpen(true)} />
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
