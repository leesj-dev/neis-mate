import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/store";
import { downloadMemo } from "@/lib/download-utils";
import { createNewVersion, duplicateMemo } from "@/lib/memo-utils";
import { GoogleDriveService } from "@/lib/google-drive";
import { MoreVertical, Download, Copy, FileText, History, Trash2, Eye, Edit } from "lucide-react";
import type { Memo } from "@/types";

interface FileVersion {
  id: string;
  modifiedTime: Date;
  size: string;
  description: string;
  fileId: string;
}

interface MemoContextMenuProps {
  memo: Memo;
  onClose?: () => void;
  onRename?: (memoId: string, currentTitle: string) => void;
}

export function MemoContextMenu({ memo, onClose, onRename }: MemoContextMenuProps) {
  const { addMemo, deleteMemo, user, updateMemo, memos } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [fileVersions, setFileVersions] = useState<FileVersion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleNewVersion = () => {
    const newMemo = createNewVersion(memo, memos);
    addMemo(newMemo);
    setShowMenu(false);
    onClose?.();
  };

  const handleDuplicate = () => {
    const duplicatedMemo = duplicateMemo(memo);
    addMemo(duplicatedMemo);
    setShowMenu(false);
    onClose?.();
  };

  const handleDownload = () => {
    downloadMemo(memo);
    setShowMenu(false);
    onClose?.();
  };

  const handleRename = () => {
    const currentTitle = memo.mode === "일반" ? memo.title : memo.displayTitle;
    onRename?.(memo.id, currentTitle || "");
    setShowMenu(false);
    onClose?.();
  };

  const handleDelete = () => {
    if (confirm("정말로 이 파일을 삭제하시겠습니까?")) {
      deleteMemo(memo.id);
      setShowMenu(false);
      onClose?.();
    }
  };

  const handleViewHistory = async () => {
    if (!user?.isLoggedIn) {
      alert("파일 히스토리는 로그인 후 이용할 수 있습니다.");
      return;
    }

    setLoadingHistory(true);
    setShowHistoryDialog(true);

    try {
      // Google Drive API를 통해 파일 버전 히스토리 가져오기
      const googleDrive = GoogleDriveService.getInstance();

      // First find the file in Google Drive
      const fileName = memo.mode === "일반" ? `${memo.title}.txt` : `${memo.internalTitle}.txt`;
      const files = await googleDrive.searchMemoFiles(fileName);

      if (files.length > 0) {
        const revisions = await googleDrive.getFileRevisions(files[0].id);
        const versions = revisions.map((revision, index) => ({
          id: revision.id,
          modifiedTime: new Date(revision.modifiedTime),
          size: revision.size || "0",
          description: index === 0 ? "현재 버전" : `이전 버전`,
          fileId: files[0].id,
        }));
        setFileVersions(versions);
      } else {
        setFileVersions([]);
      }
    } catch (error) {
      console.error("Failed to load file history:", error);
      alert("파일 히스토리를 불러오는데 실패했습니다.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (confirm("이 버전으로 되돌리시겠습니까? 현재 변경사항은 사라집니다.")) {
      try {
        const version = fileVersions.find((v) => v.id === versionId);
        if (version) {
          const googleDrive = GoogleDriveService.getInstance();
          const content = await googleDrive.getRevisionContent(version.fileId, versionId);
          const oldMemo = JSON.parse(content);

          // Update the current memo with the old content
          updateMemo(memo.id, { content: oldMemo.content });

          alert("버전 롤백이 완료되었습니다.");
          setShowHistoryDialog(false);
        }
      } catch (error) {
        console.error("Failed to rollback:", error);
        alert("버전 롤백에 실패했습니다.");
      }
    }
  };

  if (showMenu) {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
        <div className="absolute right-0 top-0 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]">
          {user?.mode === "일반" && (
            <button
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
              onClick={handleRename}
            >
              <Edit className="h-4 w-4" />
              제목 변경
            </button>
          )}
          {memo.mode !== "일반" && (
            <button
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
              onClick={handleNewVersion}
            >
              <FileText className="h-4 w-4" />새 버전
            </button>
          )}
          <button
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
            onClick={handleDuplicate}
          >
            <Copy className="h-4 w-4" />
            복제
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            다운로드
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
            onClick={handleViewHistory}
          >
            <History className="h-4 w-4" />
            파일 히스토리
          </button>
          <hr className="my-1" />
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-100 dark:hover:bg-red-900 text-red-600 flex items-center gap-2"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
            삭제
          </button>
        </div>

        {/* File History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>파일 히스토리</DialogTitle>
              <DialogDescription>파일의 버전 히스토리를 확인하고 이전 버전으로 되돌릴 수 있습니다.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {loadingHistory ? (
                <div className="text-center py-8">로딩 중...</div>
              ) : (
                fileVersions.map((version, index) => (
                  <div key={version.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">
                          {index === 0 ? "현재 버전" : `버전 ${fileVersions.length - index}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">{version.modifiedTime.toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            /* View version */
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          보기
                        </Button>
                        {index > 0 && (
                          <Button variant="outline" size="sm" onClick={() => handleRollback(version.id)}>
                            되돌리기
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">크기: {version.size} bytes</p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="opacity-0 group-hover:opacity-100 p-1 h-6 w-6"
      onClick={(e) => {
        e.stopPropagation();
        setShowMenu(true);
      }}
    >
      <MoreVertical className="h-3 w-3" />
    </Button>
  );
}
