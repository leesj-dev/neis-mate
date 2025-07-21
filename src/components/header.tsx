import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, User, RefreshCw } from 'lucide-react';
import { SettingsModal } from '@/components/settings-modal';
import { GoogleAuthButton } from '@/components/google-auth-button';

export function Header() {
  const { user, setUser, loadMemosFromDrive, syncWithDrive } = useAppStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load memos from Google Drive when user logs in
  useEffect(() => {
    const loadMemos = async () => {
      if (user?.isLoggedIn && user.googleId) {
        try {
          await loadMemosFromDrive();
        } catch (error) {
          console.error('Failed to load memos from Drive:', error);
        }
      }
    };

    loadMemos();
  }, [user?.isLoggedIn, user?.googleId, loadMemosFromDrive]);

  const handleLogout = () => {
    setUser(null);
  };

  const handleSync = async () => {
    if (!user?.isLoggedIn) return;
    
    setIsSyncing(true);
    try {
      await syncWithDrive();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user?.isLoggedIn) {
    return (
      <header className="h-14 border-b bg-card flex items-center justify-between px-6">
        <div className="font-semibold">Nice Notes</div>
        <div className="flex items-center gap-2">
          <GoogleAuthButton />
          <Button variant="outline" size="sm">
            로그인
          </Button>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="h-14 border-b bg-card flex items-center justify-between px-6">
        <div className="font-semibold">Nice Notes</div>
        
        <div className="flex items-center gap-2">
          <GoogleAuthButton />
          
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            <span>{user.name}</span>
            <span className="text-muted-foreground">({user.mode})</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing}
            title="Google Drive와 동기화"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
}
