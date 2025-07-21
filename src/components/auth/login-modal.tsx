import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/store';
import { GoogleAuthButton } from '@/components/google-auth-button';

export function LoginModal() {
  const [isOpen, setIsOpen] = useState(true);
  const { user } = useAppStore();

  // If user is logged in, close the modal
  if (user?.isLoggedIn) {
    return null;
  }

  const handleContinueWithoutLogin = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nice Notes에 오신 것을 환영합니다</DialogTitle>
          <DialogDescription>
            Google 계정으로 로그인하여 모든 기능을 사용하거나, 로그인 없이 간단한 메모를 작성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="w-full">
            <GoogleAuthButton />
          </div>
          <Button variant="outline" onClick={handleContinueWithoutLogin} className="w-full">
            로그인 없이 계속하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
