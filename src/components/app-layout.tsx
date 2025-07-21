import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Editor } from "@/components/editor";
import { LoginModal } from "@/components/auth/login-modal";
import { ModeSelector } from "@/components/auth/mode-selector";
import { GoogleDriveService } from "@/lib/google-drive";
import type { UserMode } from "@/types";

export function AppLayout() {
  const { user, setUser, loginModalDismissed } = useAppStore();
  const [isCheckingExistingData, setIsCheckingExistingData] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Check for existing data when user logs in
  const checkExistingDataAndMode = useCallback(async () => {
    if (user?.isLoggedIn && !user.mode) {
      setIsCheckingExistingData(true);

      try {
        // First check if there's existing data
        const hasData = await GoogleDriveService.hasExistingData();
        
        if (hasData) {
          // Try to load existing mode from config
          const config = await GoogleDriveService.loadUserConfig();
          
          if (config && config.mode) {
            // Set the mode from existing config
            console.log("Loading existing mode from Google Drive:", config.mode);
            setUser({ ...user, mode: config.mode as UserMode });
          } else {
            // Data exists but no mode config - default to "일반" mode
            console.log("Data exists but no mode config, defaulting to general mode");
            const defaultMode: UserMode = "일반";
            setUser({ ...user, mode: defaultMode });
            
            // Save the default mode to Drive
            await GoogleDriveService.saveUserConfig({
              mode: defaultMode,
              lastModified: new Date().toISOString()
            });
          }
        } else {
          // No existing data - show mode selector
          setShowModeSelector(true);
        }
      } catch (error) {
        console.error("Failed to check existing data:", error);
        // On error, default to showing mode selector
        setShowModeSelector(true);
      } finally {
        setIsCheckingExistingData(false);
      }
    }
  }, [user, setUser]);

  useEffect(() => {
    checkExistingDataAndMode();
  }, [checkExistingDataAndMode]);

  // Show loading state while checking for existing data
  if (user?.isLoggedIn && !user.mode && isCheckingExistingData) {
    return (
      <div className="flex h-screen bg-background text-foreground items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">계정 정보를 확인하는 중...</div>
          <div className="text-sm text-muted-foreground">Google Drive에서 기존 데이터를 확인하고 있습니다.</div>
        </div>
      </div>
    );
  }

  // Show mode selector only if user is logged in, has no mode, and has no existing data
  if (user?.isLoggedIn && !user.mode && showModeSelector) {
    return (
      <ModeSelector
        onModeSelected={async (mode: UserMode) => {
          setUser({ ...user, mode });
          setShowModeSelector(false);
          
          // Save the selected mode to Google Drive
          try {
            await GoogleDriveService.saveUserConfig({
              mode,
              lastModified: new Date().toISOString()
            });
          } catch (error) {
            console.error("Failed to save mode config:", error);
          }
        }}
      />
    );
  }
  
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block border-r">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <Editor />
      </div>
      {!user?.isLoggedIn && !loginModalDismissed && <LoginModal />}
    </div>
  );
}
