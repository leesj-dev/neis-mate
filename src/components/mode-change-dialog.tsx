import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppStore } from "@/store";
import { Eye } from "lucide-react";
import { getYears, getDefaultYear } from "@/lib/year-utils";
import { GoogleDriveService } from "@/lib/google-drive";
import type { UserMode, Grade, Year, Memo, ModeChangeData } from "@/types";

const GRADES: Grade[] = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"];
const YEARS = getYears();

interface ModeChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fromMode: UserMode;
  toMode: UserMode;
}

export function ModeChangeDialog({ isOpen, onClose, fromMode, toMode }: ModeChangeDialogProps) {
  const { memos, setMemos, user, setUser, preservedAttributes } = useAppStore();
  const [modeChangeData, setModeChangeData] = useState<ModeChangeData[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [shouldShowDialog, setShouldShowDialog] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 제목에서 정보를 자동으로 파싱하는 함수
  const parseTitle = (title: string, targetMode: UserMode) => {
    const parts = title.split("-");

    if (targetMode === "교사" && parts.length >= 4) {
      // 2025-고1-수학-이승준-1 형태 파싱
      const [yearStr, grade, subject, student] = parts;
      const year = parseInt(yearStr);

      if (YEARS.includes(year as Year) && GRADES.includes(grade as Grade)) {
        return {
          year: year as Year,
          grade: grade as Grade,
          subject,
          student,
        };
      }
    } else if (targetMode === "학생" && parts.length >= 2) {
      // 고1-수학-1 형태 파싱
      const [grade, subject] = parts;

      if (GRADES.includes(grade as Grade)) {
        return {
          grade: grade as Grade,
          subject,
        };
      }
    }

    return null;
  };

  // 모드 변환 실행 함수
  const performModeChange = useCallback(async (data: ModeChangeData[]) => {
    if (!user) return;

    const updatedMemos: Memo[] = memos.map((memo) => {
      const memoData = data.find((d) => d.memoId === memo.id);
      if (!memoData) return memo;

      const baseProps = {
        id: memo.id,
        content: memo.content,
        createdAt: memo.createdAt,
        modifiedAt: new Date(),
        viewedAt: memo.viewedAt,
        version: memo.version,
      };

      switch (toMode) {
        case "일반":
          return {
            ...baseProps,
            mode: "일반",
            title: memoData.title || memoData.currentTitle,
          };
        case "학생":
          return {
            ...baseProps,
            mode: "학생",
            grade: memoData.grade!,
            subject: memoData.subject!,
            internalTitle: `${memoData.grade}-${memoData.subject}-${memo.version}`,
            displayTitle: memo.version > 1 ? `${memoData.subject}-${memo.version}` : memoData.subject!,
          };
        case "교사":
          return {
            ...baseProps,
            mode: "교사",
            year: memoData.year!,
            grade: memoData.grade!,
            subject: memoData.subject!,
            student: memoData.student!,
            internalTitle: `${memoData.year}-${memoData.grade}-${memoData.subject}-${memoData.student}-${memo.version}`,
            displayTitle: memoData.student!,
          };
        default:
          return memo;
      }
    });

    setMemos(updatedMemos);
    setUser({ ...user, mode: toMode });
    
    // Save the new mode to Google Drive
    if (user?.isLoggedIn) {
      try {
        await GoogleDriveService.saveUserConfig({
          mode: toMode,
          lastModified: new Date().toISOString()
        });
      } catch (error) {
        console.error("Failed to save mode config:", error);
      }
    }
    
    onClose();
  }, [user, memos, toMode, setMemos, setUser, onClose]);

  // 자동 변환 가능 여부를 미리 확인하는 함수
  const checkAutoConvertPossible = useCallback(() => {
    const data: ModeChangeData[] = memos.map((memo) => {
      const currentTitle = memo.mode === "일반" ? memo.title : memo.internalTitle;
      const parsedData = parseTitle(currentTitle, toMode);

      // Use preserved attributes as fallback for missing data
      const fallbackData = {
        year: (preservedAttributes.year as Year) || (toMode === "교사" ? parsedData?.year || getDefaultYear() : undefined),
        grade: (preservedAttributes.grade as Grade) || (toMode === "학생" || toMode === "교사" ? parsedData?.grade || "중1" : undefined),
        subject: preservedAttributes.subject || (toMode === "학생" || toMode === "교사" ? parsedData?.subject || "" : undefined),
        student: preservedAttributes.student || (toMode === "교사" ? parsedData?.student || "" : undefined),
        title: preservedAttributes.title || (toMode === "일반" ? currentTitle : undefined),
      };

      return {
        memoId: memo.id,
        currentTitle,
        content: memo.content,
        ...fallbackData,
      };
    });

    const canAutoConvert = data.every((item) => {
      if (toMode === "일반") {
        return item.title && item.title.trim().length > 0;
      } else if (toMode === "학생") {
        return item.grade && item.subject && item.subject.trim().length > 0;
      } else if (toMode === "교사") {
        return (
          item.year &&
          item.grade &&
          item.subject &&
          item.subject.trim().length > 0 &&
          item.student &&
          item.student.trim().length > 0
        );
      }
      return false;
    });

    return { data, canAutoConvert };
  }, [memos, toMode, preservedAttributes]);

  const initializeModeChangeData = useCallback(() => {
    const { data } = checkAutoConvertPossible();
    setModeChangeData(data);
    setShouldShowDialog(true);
    setDialogOpen(true);
  }, [checkAutoConvertPossible]);

  const updateModeChangeData = (index: number, field: keyof ModeChangeData, value: string | number | Grade | Year) => {
    setModeChangeData((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleConfirmModeChange = () => {
    setDialogOpen(false);
    performModeChange(modeChangeData);
  };

  const validateData = () => {
    return modeChangeData.every((data) => {
      if (toMode === "일반") {
        return data.title && data.title.trim().length > 0;
      } else if (toMode === "학생") {
        return data.grade && data.subject && data.subject.trim().length > 0;
      } else if (toMode === "교사") {
        return (
          data.year &&
          data.grade &&
          data.subject &&
          data.subject.trim().length > 0 &&
          data.student &&
          data.student.trim().length > 0
        );
      }
      return false;
    });
  };

  const isValid = validateData();

  // 다이얼로그가 열릴 때 데이터 초기화
  useEffect(() => {
    if (isOpen) {
      const { canAutoConvert } = checkAutoConvertPossible();
      
      if (canAutoConvert) {
        // 자동 변환 가능하면 다이얼로그 열지 않고 바로 변환
        const { data } = checkAutoConvertPossible();
        performModeChange(data);
      } else if (modeChangeData.length === 0) {
        // 자동 변환 불가능하면 다이얼로그 열고 데이터 초기화
        setDialogOpen(true);
        initializeModeChangeData();
      }
    }
  }, [isOpen, modeChangeData.length, checkAutoConvertPossible, performModeChange, initializeModeChangeData]);

  // 다이얼로그가 닫힐 때 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setModeChangeData([]);
      setShowPreview(null);
      setShouldShowDialog(true);
      setDialogOpen(false);
    }
  }, [isOpen]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    onClose();
  };

  if (!isOpen || !shouldShowDialog) return null;

  return (
    <Dialog open={isOpen && dialogOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            모드 변경: {fromMode} → {toMode}
          </DialogTitle>
          <DialogDescription>각 파일의 정보를 새로운 모드에 맞게 입력해주세요.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium border-b pb-2">
              <div className="col-span-2">현재 제목</div>
              {toMode === "일반" && <div className="col-span-3">새 제목</div>}
              {(toMode === "학생" || toMode === "교사") && <div className="col-span-2">학년</div>}
              {(toMode === "학생" || toMode === "교사") && <div className="col-span-2">과목</div>}
              {toMode === "교사" && <div className="col-span-2">학년도</div>}
              {toMode === "교사" && <div className="col-span-2">학생</div>}
              <div className="col-span-1">보기</div>
            </div>

            {modeChangeData.map((data, index) => (
              <div key={data.memoId} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2 text-sm truncate" title={data.currentTitle}>
                  {data.currentTitle}
                </div>

                {toMode === "일반" && (
                  <div className="col-span-3">
                    <Input
                      value={data.title || ""}
                      onChange={(e) => updateModeChangeData(index, "title", e.target.value)}
                      placeholder="제목 입력"
                      className="h-8"
                    />
                  </div>
                )}

                {(toMode === "학생" || toMode === "교사") && (
                  <div className="col-span-2">
                    <Select
                      value={data.grade || ""}
                      onValueChange={(value) => updateModeChangeData(index, "grade", value as Grade)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(toMode === "학생" || toMode === "교사") && (
                  <div className="col-span-2">
                    <Input
                      value={data.subject || ""}
                      onChange={(e) => updateModeChangeData(index, "subject", e.target.value)}
                      placeholder="과목"
                      className="h-8"
                    />
                  </div>
                )}

                {toMode === "교사" && (
                  <div className="col-span-2">
                    <Select
                      value={data.year?.toString() || ""}
                      onValueChange={(value) => updateModeChangeData(index, "year", parseInt(value) as Year)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="연도" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {toMode === "교사" && (
                  <div className="col-span-2">
                    <Input
                      value={data.student || ""}
                      onChange={(e) => updateModeChangeData(index, "student", e.target.value)}
                      placeholder="학생"
                      className="h-8"
                    />
                  </div>
                )}

                <div className="col-span-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(data.memoId)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleDialogClose}>
              취소
            </Button>
            <Button onClick={handleConfirmModeChange} disabled={!isValid}>
              모드 변경
            </Button>
          </div>
        </div>

        {/* Preview Dialog */}
        {showPreview && (
          <Dialog open={!!showPreview} onOpenChange={() => setShowPreview(null)}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>내용 미리보기</DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm">
                  {modeChangeData.find((d) => d.memoId === showPreview)?.content}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
