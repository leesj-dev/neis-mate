import { googleLogout } from "@react-oauth/google";
import { useAppStore } from "@/store";

// Google 로그아웃 함수
export const useGoogleSignOut = () => {
  const { setUser, setLoginModalDismissed } = useAppStore();

  return () => {
    googleLogout();

    // localStorage 정리
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_token_expiry");
    localStorage.removeItem("google_refresh_token");

    // Zustand store 정리
    setUser(null);
    setLoginModalDismissed(false);
  };
};
