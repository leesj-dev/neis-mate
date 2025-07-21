import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider } from '@/components/theme-provider';
import { AppLayout } from '@/components/app-layout';

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.error('VITE_GOOGLE_CLIENT_ID is not set');
    return <div>Google Client ID is not configured</div>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ThemeProvider defaultTheme="system" storageKey="neis-notes-theme">
        <AppLayout />
      </ThemeProvider>
    </GoogleOAuthProvider>
  )
}

export default App
