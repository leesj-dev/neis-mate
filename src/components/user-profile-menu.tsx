import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store";
import { GoogleDriveService } from "@/lib/google-drive";
import { LogOut, User, Settings } from "lucide-react";

interface UserProfileMenuProps {
  onSettingsClick?: () => void;
}

export function UserProfileMenu({ onSettingsClick }: UserProfileMenuProps) {
  const { user, setUser } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleLogout = async () => {
    try {
      // Google Drive 서비스를 통해 로그아웃
      const googleDrive = GoogleDriveService.getInstance();
      await googleDrive.signOut();

      // 사용자 상태 초기화
      setUser(null);

      // 로컬 스토리지 정리
      localStorage.removeItem("google_access_token");
      localStorage.removeItem("google_token_expiry");
      localStorage.removeItem("google_refresh_token");

      console.log("Successfully logged out");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setShowMenu(false);
    }
  };

  const handleSettingsClick = () => {
    setShowMenu(false);
    onSettingsClick?.();
  };

  if (!user?.isLoggedIn) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted transition-colors cursor-pointer"
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full" />
        ) : (
          <User className="w-4 h-4" />
        )}
        <span className="text-foreground">{user.name}</span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]">
            <button
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
              onClick={handleSettingsClick}
            >
              <Settings className="h-4 w-4" />
              설정
            </button>
            <hr className="my-1" />
            <button
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900 flex items-center gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
