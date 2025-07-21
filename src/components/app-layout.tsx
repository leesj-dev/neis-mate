import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { Editor } from '@/components/editor';
import { LoginModal } from '@/components/auth/login-modal';
import { ModeSelector } from '@/components/auth/mode-selector';
import { GoogleDriveService } from '@/lib/google-drive';

export function AppLayout() {
  const { user, setUser } = useAppStore();

  useEffect(() => {
    // 앱 초기화 시 Google 인증 상태 확인
    const initializeAuth = async () => {
      try {
        const driveService = GoogleDriveService.getInstance();
        const authenticated = driveService.isAuthenticated();

        if (authenticated && !user?.isLoggedIn) {
          const userInfo = await driveService.getUserInfo();
          if (userInfo) {
            setUser({
              id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              mode: user?.mode,
              isLoggedIn: true,
              googleId: userInfo.id,
            });
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      }
    };

    initializeAuth();
  }, [user?.isLoggedIn, user?.mode, setUser]);

  // Show mode selector for logged in users without a mode
  if (user?.isLoggedIn && !user.mode) {
    return <ModeSelector />;
  }

  // Show login modal for users who are not logged in and haven't dismissed it
  const showLoginModal = !user?.isLoggedIn && !user;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <Editor />
      </div>
      {showLoginModal && <LoginModal />}
    </div>
  );
}
