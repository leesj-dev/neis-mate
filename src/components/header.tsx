import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { SettingsModal } from "@/components/settings-modal";
import { GoogleAuth } from "@/components/google-auth";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu } from "lucide-react";

export function Header() {
  const { user, loadMemosFromDrive, googleDriveLoaded } = useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Load memos from Google Drive when user logs in (only once)
  useEffect(() => {
    if (user?.isLoggedIn && user.googleId && user.mode && !googleDriveLoaded && !isLoadingFromDrive) {
      console.log("Header: Loading memos from Google Drive for the first time");
      setIsLoadingFromDrive(true);
      
      loadMemosFromDrive()
        .catch(error => {
          console.error("Failed to load memos from Drive:", error);
          // 조용히 로그만 남기고 사용자에게 알리지 않음 (최초 로그인 시)
        })
        .finally(() => {
          setIsLoadingFromDrive(false);
        });
    }
  }, [user?.isLoggedIn, user?.googleId, user?.mode, googleDriveLoaded, loadMemosFromDrive, isLoadingFromDrive]);

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
      <header className="h-14 border-b bg-card flex items-center justify-between pl-3 md:pl-6 pr-3">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          {user?.isLoggedIn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden flex size-8 cursor-pointer items-center justify-center rounded-md p-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="font-semibold text-xl">NEIS Mate</h1>
        </div>

        <div className="flex items-center gap-2">
          {isLoadingFromDrive && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
              <span className="hidden sm:inline">Google Drive 동기화 중...</span>
            </div>
          )}
          <GoogleAuth onSettingsClick={() => setIsSettingsOpen(true)} />
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Mobile Sidebar Dialog */}
      {user?.isLoggedIn && (
        <Dialog open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <DialogContent className="h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] m-6 p-0  rounded-lg md:hidden translate-x-0 translate-y-0 left-0 top-0 [&>button]:hidden overflow-hidden">
            <Sidebar onMobileClose={() => setIsMobileSidebarOpen(false)} isMobile />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
