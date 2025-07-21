import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { GoogleDriveService } from '@/lib/google-drive';
import { useAppStore } from '@/store';
import { User, LogIn, LogOut } from 'lucide-react';

interface GoogleUserInfo {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export function GoogleAuthButton() {
  const { user, setUser } = useAppStore();
  const [userInfo, setUserInfo] = useState<GoogleUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    try {
      const driveService = GoogleDriveService.getInstance();
      const authenticated = driveService.isAuthenticated();

      if (authenticated) {
        const googleUser = await driveService.getUserInfo();
        if (googleUser) {
          setUserInfo(googleUser);
          // Google 로그인 상태를 앱 사용자 상태에 반영
          if (!user?.isLoggedIn) {
            setUser({
              id: googleUser.id,
              email: googleUser.email,
              name: googleUser.name,
              picture: googleUser.picture,
              mode: user?.mode,
              isLoggedIn: true,
              googleId: googleUser.id,
            });
          }
        }
      } else {
        setUserInfo(null);
        // Google 로그아웃 상태를 앱 사용자 상태에 반영
        if (user?.isLoggedIn) {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  }, [user, setUser]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      const driveService = GoogleDriveService.getInstance();
      
      // OAuth 인증 플로우 시작
      await driveService.startAuthFlow();
    } catch (error) {
      console.error('Failed to sign in:', error);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      const driveService = GoogleDriveService.getInstance();
      await driveService.signOut();
      
      setUserInfo(null);
      setUser(null);
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (user?.isLoggedIn && userInfo) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-sm">
          {userInfo.picture ? (
            <img 
              src={userInfo.picture} 
              alt={userInfo.name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
          <span className="text-gray-700 dark:text-gray-300">
            {userInfo.name}
          </span>
        </div>
        <Button
          onClick={handleSignOut}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-1"
    >
      <LogIn className="w-3 h-3" />
      {isLoading ? 'Connecting...' : 'Sign in with Google'}
    </Button>
  );
}
