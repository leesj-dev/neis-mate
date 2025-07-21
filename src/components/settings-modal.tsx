import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useTheme } from '@/components/theme-provider';
import { useAppStore } from '@/store';
import { downloadAllMemos } from '@/lib/download-utils';
import { ModeChangeDialog } from '@/components/mode-change-dialog';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { UserMode } from '@/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, memos, folders, setUser, setMemos, setFolders } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showModeChangeDialog, setShowModeChangeDialog] = useState(false);
  const [targetMode, setTargetMode] = useState<UserMode>('일반');

  const handleModeChange = (newMode: UserMode) => {
    if (!user) return;
    
    const currentMode = user.mode;
    
    // Direct mode changes (no data conversion needed)
    if ((currentMode === '학생' && newMode === '일반') ||
        (currentMode === '교사' && newMode === '일반') ||
        (currentMode === '교사' && newMode === '학생')) {
      
      // Convert internal titles to appropriate format
      const convertedMemos = memos.map(memo => {
        const baseProps = {
          id: memo.id,
          content: memo.content,
          createdAt: memo.createdAt,
          modifiedAt: new Date(),
          viewedAt: memo.viewedAt,
          version: memo.version,
        };

        if (newMode === '일반') {
          return {
            ...baseProps,
            mode: '일반' as const,
            title: memo.mode === '일반' ? memo.title : memo.internalTitle,
          };
        } else if (currentMode === '교사' && newMode === '학생') {
          if (memo.mode === '교사') {
            return {
              ...baseProps,
              mode: '학생' as const,
              grade: memo.grade,
              subject: memo.subject,
              internalTitle: `${memo.grade}-${memo.subject}-${memo.version}`,
              displayTitle: memo.version > 1 ? `${memo.subject}-${memo.version}` : memo.subject,
            };
          }
        }
        return memo;
      });

      setMemos(convertedMemos);
      setUser({ ...user, mode: newMode });
      onClose();
    } else {
      // Complex mode changes requiring user input
      setTargetMode(newMode);
      setShowModeChangeDialog(true);
    }
  };

  const handleDownloadAll = async () => {
    if (!user || !memos.length) return;
    
    setIsDownloading(true);
    try {
      await downloadAllMemos(memos, folders, user.mode);
    } catch (error) {
      console.error('Failed to download all memos:', error);
    }
    setIsDownloading(false);
  };

  const handleReset = () => {
    if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setMemos([]);
      setFolders([]);
      onClose();
    }
  };

  const canChangeMode = (targetMode: UserMode) => {
    if (!user) return false;
    
    const currentMode = user.mode;
    
    // Allowed mode changes
    if (currentMode === '학생' && targetMode === '일반') return true;
    if (currentMode === '교사' && targetMode === '일반') return true;
    if (currentMode === '교사' && targetMode === '학생') return true;
    
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>
            앱 설정을 관리하고 데이터를 내보내거나 초기화할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Theme Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">테마 설정</h3>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                라이트
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                다크
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                시스템
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              시스템 설정을 선택하면 운영체제의 테마 설정을 자동으로 따릅니다.
            </p>
          </div>

          {/* Current Mode */}
          <div>
            <h3 className="text-sm font-medium mb-2">현재 모드</h3>
            <div className="text-sm text-muted-foreground">
              {user?.mode || '로그인 필요'}
            </div>
          </div>

          {/* Mode Change */}
          {user && (
            <div>
              <h3 className="text-sm font-medium mb-3">모드 변경</h3>
              <div className="space-y-2">
                {canChangeMode('일반') && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleModeChange('일반')}
                  >
                    일반 모드로 변경
                  </Button>
                )}
                {canChangeMode('학생') && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => handleModeChange('학생')}
                  >
                    학생 모드로 변경
                  </Button>
                )}
                {!canChangeMode('일반') && !canChangeMode('학생') && (
                  <div className="text-sm text-muted-foreground">
                    현재 모드에서는 직접 변경할 수 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Management */}
          <div>
            <h3 className="text-sm font-medium mb-3">데이터 관리</h3>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleDownloadAll}
                disabled={!memos.length || isDownloading}
              >
                {isDownloading ? '다운로드 중...' : '전체 노트 다운로드'}
              </Button>
              
              <Button 
                variant="destructive" 
                className="w-full justify-start"
                onClick={handleReset}
              >
                모든 데이터 초기화
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Mode Change Dialog */}
      {user && showModeChangeDialog && (
        <ModeChangeDialog
          isOpen={showModeChangeDialog}
          onClose={() => setShowModeChangeDialog(false)}
          fromMode={user.mode}
          toMode={targetMode}
        />
      )}
    </Dialog>
  );
}
