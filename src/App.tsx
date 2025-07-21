import { ThemeProvider } from '@/components/theme-provider';
import { AppLayout } from '@/components/app-layout';
import { OAuthCallback } from '@/components/oauth-callback';
import './App.css'

function App() {
  // OAuth 콜백 처리
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('code') || urlParams.has('error');

  if (isOAuthCallback) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="nice-notes-theme">
        <OAuthCallback />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="nice-notes-theme">
      <AppLayout />
    </ThemeProvider>
  )
}

export default App
