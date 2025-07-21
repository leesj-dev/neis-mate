import { useEffect } from 'react';
import { GoogleDriveService } from '../lib/google-drive';
import { useAppStore } from '../store';

export function OAuthCallback() {
  const { setUser } = useAppStore();

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        window.location.href = '/';
        return;
      }

      if (code) {
        try {
          const driveService = GoogleDriveService.getInstance();
          await driveService.exchangeCodeForToken(code);
          
          // 사용자 정보 가져오기
          const userInfo = await driveService.getUserInfo();
          if (userInfo) {
            console.log('User authenticated:', userInfo);
            
            // 앱 사용자 상태 업데이트
            setUser({
              id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              isLoggedIn: true,
              googleId: userInfo.id,
            });
          }
          
          // 홈으로 리다이렉트
          window.location.href = '/';
        } catch (error) {
          console.error('Failed to exchange code for token:', error);
          window.location.href = '/';
        }
      }
    };

    handleCallback();
  }, [setUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Authenticating with Google Drive...
        </p>
      </div>
    </div>
  );
}
