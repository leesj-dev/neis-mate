import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { useAppStore } from "@/store";
import { downloadAllMemos } from "@/lib/download-utils";
import { getYears } from "@/lib/year-utils";
import { GoogleDriveService } from "@/lib/google-drive";
import { ModeChangeDialog } from "@/components/mode-change-dialog";
import { Monitor, Moon, Sun, FolderOpen, Edit } from "lucide-react";
import type { UserMode, Grade, Year } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { 
    user, 
    memos, 
    folders, 
    setUser, 
    setMemos, 
    setFolders, 
    autoSaveInterval, 
    setAutoSaveInterval,
    googleDriveFolderId,
    googleDriveFolderName,
    setGoogleDriveFolderId,
    setGoogleDriveFolderName
  } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [showModeChangeDialog, setShowModeChangeDialog] = useState(false);
  const [targetMode, setTargetMode] = useState<UserMode>("일반");
  const [googleDriveFolders, setGoogleDriveFolders] = useState<Array<{id: string, name: string}>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isEditingFolderName, setIsEditingFolderName] = useState(false);
  const [newFolderName, setNewFolderName] = useState(googleDriveFolderName);
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);

  // 구글 드라이브 폴더 목록 로드
  const loadGoogleDriveFolders = useCallback(async () => {
    if (!user?.isLoggedIn) return;
    
    setIsLoadingFolders(true);
    try {
      const googleDrive = GoogleDriveService.getInstance();
      if (googleDrive.isAuthenticated()) {
        // 폴더 확인/생성
        const folderId = await googleDrive.ensureNeisMateFolder();
        
        // 현재 폴더의 실제 이름 가져오기
        const folderInfo = await googleDrive.getFolderInfo(folderId);
        const actualFolderName = folderInfo.name;
        
        const folders = [{ id: folderId, name: actualFolderName }];
        setGoogleDriveFolders(folders);
        
        // 폴더 ID가 설정되지 않았으면 설정
        if (!googleDriveFolderId) {
          setGoogleDriveFolderId(folderId);
        }
        
        // 폴더 이름이 변경되었으면 업데이트
        if (actualFolderName !== googleDriveFolderName) {
          setGoogleDriveFolderName(actualFolderName);
        }
      }
    } catch (error) {
      console.error('Failed to load Google Drive folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [user?.isLoggedIn, googleDriveFolderId, googleDriveFolderName, setGoogleDriveFolderId, setGoogleDriveFolderName]);

  useEffect(() => {
    if (isOpen && user?.isLoggedIn) {
      loadGoogleDriveFolders();
    }
  }, [isOpen, user?.isLoggedIn, loadGoogleDriveFolders]);

  // 폴더 이름 변경
  const handleRenameFolderName = async () => {
    if (!googleDriveFolderId || !newFolderName.trim()) return;
    
    setIsRenamingFolder(true);
    try {
      const googleDrive = GoogleDriveService.getInstance();
      if (googleDrive.isAuthenticated()) {
        await googleDrive.renameFolder(googleDriveFolderId, newFolderName.trim());
        setGoogleDriveFolderName(newFolderName.trim());
        setIsEditingFolderName(false);
        
        // 폴더 목록 새로고침
        await loadGoogleDriveFolders();
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
      // 실패 시 원래 이름으로 되돌리기
      setNewFolderName(googleDriveFolderName);
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleCancelRename = () => {
    setNewFolderName(googleDriveFolderName);
    setIsEditingFolderName(false);
  };

  // 제목에서 정보를 자동으로 파싱할 수 있는지 확인하는 함수
  const canAutoParseTitle = (title: string, targetMode: UserMode) => {
    const parts = title.split("-");

    if (targetMode === "교사" && parts.length >= 4) {
      const [yearStr, grade, subject, student] = parts;
      const year = parseInt(yearStr);
      const YEARS = getYears();
      const GRADES: Grade[] = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

      return YEARS.includes(year as Year) && GRADES.includes(grade as Grade) && subject.trim() && student.trim();
    } else if (targetMode === "학생" && parts.length >= 2) {
      const [grade, subject] = parts;
      const GRADES: Grade[] = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];

      return GRADES.includes(grade as Grade) && subject.trim();
    }

    return false;
  };

  const handleModeChange = async (newMode: UserMode) => {
    if (!user) return;

    const currentMode = user.mode;

    // 파일이 없는 경우 직접 모드 변경
    if (memos.length === 0) {
      setUser({ ...user, mode: newMode });
      
      // Save the new mode to Google Drive
      if (user?.isLoggedIn) {
        try {
          await GoogleDriveService.saveUserConfig({
            mode: newMode,
            lastModified: new Date().toISOString()
          });
        } catch (error) {
          console.error("Failed to save mode config:", error);
        }
      }
      
      onClose();
      return;
    }

    // Check if all memos can be auto-parsed
    const allCanBeParsed = memos.every((memo) => {
      const title = memo.mode === "일반" ? memo.title : memo.internalTitle;
      return canAutoParseTitle(title, newMode);
    });

    // Direct mode changes (no data conversion needed) or auto-parseable
    if (
      (currentMode === "학생" && newMode === "일반") ||
      (currentMode === "교사" && newMode === "일반") ||
      (currentMode === "교사" && newMode === "학생") ||
      allCanBeParsed
    ) {
      // Convert internal titles to appropriate format
      const convertedMemos = memos.map((memo) => {
        const baseProps = {
          id: memo.id,
          content: memo.content,
          createdAt: memo.createdAt,
          modifiedAt: new Date(),
          viewedAt: memo.viewedAt,
          version: memo.version,
        };

        if (newMode === "일반") {
          return {
            ...baseProps,
            mode: "일반" as const,
            title: memo.mode === "일반" ? memo.title : memo.internalTitle,
          };
        } else if (currentMode === "교사" && newMode === "학생") {
          if (memo.mode === "교사") {
            return {
              ...baseProps,
              mode: "학생" as const,
              grade: memo.grade,
              subject: memo.subject,
              internalTitle: `${memo.grade}-${memo.subject}-${memo.version}`,
              displayTitle: memo.version > 1 ? `${memo.subject}-${memo.version}` : memo.subject,
            };
          }
        } else if (allCanBeParsed) {
          // Auto-parse the title
          const title = memo.mode === "일반" ? memo.title : memo.internalTitle;
          const parts = title.split("-");

          if (newMode === "교사" && parts.length >= 4) {
            const [yearStr, grade, subject, student] = parts;
            return {
              ...baseProps,
              mode: "교사" as const,
              year: parseInt(yearStr) as Year,
              grade: grade as Grade,
              subject,
              student,
              internalTitle: `${yearStr}-${grade}-${subject}-${student}-${memo.version}`,
              displayTitle: student,
            };
          } else if (newMode === "학생" && parts.length >= 2) {
            const [grade, subject] = parts;
            return {
              ...baseProps,
              mode: "학생" as const,
              grade: grade as Grade,
              subject,
              internalTitle: `${grade}-${subject}-${memo.version}`,
              displayTitle: memo.version > 1 ? `${subject}-${memo.version}` : subject,
            };
          }
        }
        return memo;
      });

      setMemos(convertedMemos);
      setUser({ ...user, mode: newMode });
      
      // Save the new mode to Google Drive
      if (user?.isLoggedIn) {
        try {
          await GoogleDriveService.saveUserConfig({
            mode: newMode,
            lastModified: new Date().toISOString()
          });
        } catch (error) {
          console.error("Failed to save mode config:", error);
        }
      }
      
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
      await downloadAllMemos(memos, folders, user.mode ?? "일반");
    } catch (error) {
      console.error("Failed to download all memos:", error);
    }
    setIsDownloading(false);
  };

  const handleReset = () => {
    if (confirm("정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      setMemos([]);
      setFolders([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>앱 설정을 관리하고 데이터를 내보내거나 초기화할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Selection */}
          <div>
            <h3 className="text-base font-medium mb-2">테마 설정</h3>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                라이트
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                다크
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                시스템
              </Button>
            </div>
          </div>

          {/* Auto-save Settings */}
          <div>
            <h3 className="text-base font-medium mb-2">자동 저장 간격</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Select
                  value={autoSaveInterval.toString()}
                  onValueChange={(value) => setAutoSaveInterval(parseInt(value))}
                >
                  <SelectTrigger className="w-22 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">끄기</SelectItem>
                    <SelectItem value="1">1분</SelectItem>
                    <SelectItem value="2">2분</SelectItem>
                    <SelectItem value="3">3분</SelectItem>
                    <SelectItem value="5">5분</SelectItem>
                    <SelectItem value="10">10분</SelectItem>
                    <SelectItem value="15">15분</SelectItem>
                    <SelectItem value="30">30분</SelectItem>
                    <SelectItem value="60">1시간</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {autoSaveInterval === 0 && "자동 저장이 비활성화되었습니다. 수동으로 저장해야 합니다."}
              </p>
            </div>
          </div>

          {/* Google Drive Folder Setting */}
          {user?.isLoggedIn && (
            <div>
              <h3 className="text-base font-medium mb-2">Google Drive 저장 폴더</h3>
              <div className="space-y-2">
                {isEditingFolderName ? (
                  <div className="flex gap-2">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="폴더 이름을 입력하세요"
                      className="w-50 h-9"
                      disabled={isRenamingFolder}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameFolderName();
                        } else if (e.key === 'Escape') {
                          handleCancelRename();
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleCancelRename}
                        disabled={isRenamingFolder}
                      >
                        취소
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleRenameFolderName}
                        disabled={isRenamingFolder || !newFolderName.trim()}
                      >
                        {isRenamingFolder ? "저장 중..." : "저장"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select 
                      value={googleDriveFolderId || ""} 
                      onValueChange={setGoogleDriveFolderId}
                      disabled={isLoadingFolders}
                    >
                      <SelectTrigger className="w-50 h-9">
                        <SelectValue placeholder="폴더를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {googleDriveFolders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4" />
                              {folder.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setNewFolderName(googleDriveFolderName);
                        setIsEditingFolderName(true);
                      }}
                      disabled={isLoadingFolders || !googleDriveFolderId}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Mode */}
          <div>
            <h3 className="text-base font-medium mb-2">현재 모드</h3>
            <div className="text-sm text-muted-foreground">{user?.mode || "로그인 필요"}</div>
          </div>

          {/* Mode Change */}
          {user && (
            <div>
              <h3 className="text-base font-medium mb-2">모드 변경</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {user.mode !== "일반" && (
                    <Button variant="outline" onClick={() => handleModeChange("일반")}>
                      일반 모드로 변경
                    </Button>
                  )}
                  {user.mode !== "학생" && (
                    <Button variant="outline" onClick={() => handleModeChange("학생")}>
                      학생 모드로 변경
                    </Button>
                  )}
                  {user.mode !== "교사" && (
                    <Button variant="outline" onClick={() => handleModeChange("교사")}>
                      교사 모드로 변경
                    </Button>
                  )}
                </div>
                {memos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    모드 변경 시 데이터 변환이 필요할 수 있습니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data Management */}
          <div>
            <h3 className="text-base font-medium mb-2">데이터 관리</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                disabled={!memos.length || isDownloading}
              >
                {isDownloading ? "다운로드 중..." : "전체 노트 다운로드"}
              </Button>

              <Button variant="destructive" onClick={handleReset}>
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
          fromMode={user.mode ?? "일반"}
          toMode={targetMode}
        />
      )}
    </Dialog>
  );
}
