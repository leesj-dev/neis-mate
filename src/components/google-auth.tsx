import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { UserProfileMenu } from "./user-profile-menu";

interface GoogleUserInfo {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

interface GoogleAuthProps {
  onSettingsClick?: () => void;
  className?: string;
}

export function GoogleAuth({ onSettingsClick, className }: GoogleAuthProps) {
  const { user, setUser } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);

      try {
        // 액세스 토큰으로 사용자 정보 가져오기
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (userInfoResponse.ok) {
          const userInfo: GoogleUserInfo = await userInfoResponse.json();

          // Zustand store에 사용자 정보 저장
          setUser({
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            isLoggedIn: true,
            googleId: userInfo.id,
            accessToken: tokenResponse.access_token,
          });

          // 토큰을 localStorage에도 저장 (Drive API 사용을 위해)
          localStorage.setItem("google_access_token", tokenResponse.access_token);
          // expires_in이 있으면 그 값을 사용, 없으면 기본 1시간
          const expiresIn = tokenResponse.expires_in || 3600;
          localStorage.setItem("google_token_expiry", (Date.now() + expiresIn * 1000).toString());
        } else {
          console.error("Failed to fetch user info");
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      } finally {
        setIsLoading(false);
      }
    },
    onError: (error) => {
      console.error("Google login failed:", error);
      setIsLoading(false);
    },
    scope:
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
  });

  if (user?.isLoggedIn) {
    return <UserProfileMenu onSettingsClick={onSettingsClick} />;
  }

  return (
    <Button onClick={() => login()} disabled={isLoading} variant="outline" size="sm" className={`gap-1 ${className || ""}`}>
      <LogIn className="w-3 h-3" />
      {isLoading ? "연결 중..." : "Google로 로그인"}
    </Button>
  );
}
