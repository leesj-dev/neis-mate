import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/store';
import { Eye } from 'lucide-react';
import type { UserMode, Grade, Year, Memo, ModeChangeData } from '@/types';

const GRADES: Grade[] = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const YEARS: Year[] = [2021, 2022, 2023, 2024, 2025];

interface ModeChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fromMode: UserMode;
  toMode: UserMode;
}

export function ModeChangeDialog({ isOpen, onClose, fromMode, toMode }: ModeChangeDialogProps) {
  const { memos, setMemos, user, setUser } = useAppStore();
  const [modeChangeData, setModeChangeData] = useState<ModeChangeData[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const initializeModeChangeData = () => {
    const data: ModeChangeData[] = memos.map(memo => ({
      memoId: memo.id,
      currentTitle: memo.mode === '일반' ? memo.title : memo.internalTitle,
      content: memo.content,
      year: toMode === '교사' ? 2024 : undefined,
      grade: (toMode === '학생' || toMode === '교사') ? '중1' : undefined,
      subject: (toMode === '학생' || toMode === '교사') ? '' : undefined,
      student: toMode === '교사' ? '' : undefined,
      title: toMode === '일반' ? memo.mode === '일반' ? memo.title : memo.internalTitle : undefined,
    }));
    setModeChangeData(data);
  };

  const updateModeChangeData = (index: number, field: keyof ModeChangeData, value: string | number | Grade | Year) => {
    setModeChangeData(prev => 
      prev.map((item, i) => i === index ? { ...item, [field]: value } : item)
    );
  };

  const handleConfirmModeChange = () => {
    if (!user) return;

    const updatedMemos: Memo[] = memos.map(memo => {
      const data = modeChangeData.find(d => d.memoId === memo.id);
      if (!data) return memo;

      const baseProps = {
        id: memo.id,
        content: memo.content,
        createdAt: memo.createdAt,
        modifiedAt: new Date(),
        viewedAt: memo.viewedAt,
        version: memo.version,
      };

      switch (toMode) {
        case '일반':
          return {
            ...baseProps,
            mode: '일반',
            title: data.title || data.currentTitle,
          };
        case '학생':
          return {
            ...baseProps,
            mode: '학생',
            grade: data.grade!,
            subject: data.subject!,
            internalTitle: `${data.grade}-${data.subject}-${memo.version}`,
            displayTitle: memo.version > 1 ? `${data.subject}-${memo.version}` : data.subject!,
          };
        case '교사':
          return {
            ...baseProps,
            mode: '교사',
            year: data.year!,
            grade: data.grade!,
            subject: data.subject!,
            student: data.student!,
            internalTitle: `${data.year}-${data.grade}-${data.subject}-${data.student}-${memo.version}`,
            displayTitle: data.student!,
          };
        default:
          return memo;
      }
    });

    setMemos(updatedMemos);
    setUser({ ...user, mode: toMode });
    onClose();
  };

  const validateData = () => {
    return modeChangeData.every(data => {
      if (toMode === '일반') {
        return data.title && data.title.trim().length > 0;
      } else if (toMode === '학생') {
        return data.grade && data.subject && data.subject.trim().length > 0;
      } else if (toMode === '교사') {
        return data.year && data.grade && data.subject && data.subject.trim().length > 0 && 
               data.student && data.student.trim().length > 0;
      }
      return false;
    });
  };

  const isValid = validateData();

  if (!isOpen) return null;

  if (modeChangeData.length === 0) {
    initializeModeChangeData();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>모드 변경: {fromMode} → {toMode}</DialogTitle>
          <DialogDescription>
            각 메모의 정보를 새로운 모드에 맞게 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium border-b pb-2">
              <div className="col-span-2">현재 제목</div>
              {toMode === '일반' && <div className="col-span-3">새 제목</div>}
              {(toMode === '학생' || toMode === '교사') && <div className="col-span-2">학년</div>}
              {(toMode === '학생' || toMode === '교사') && <div className="col-span-2">과목</div>}
              {toMode === '교사' && <div className="col-span-2">연도</div>}
              {toMode === '교사' && <div className="col-span-2">학생</div>}
              <div className="col-span-1">보기</div>
            </div>

            {modeChangeData.map((data, index) => (
              <div key={data.memoId} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2 text-sm truncate" title={data.currentTitle}>
                  {data.currentTitle}
                </div>

                {toMode === '일반' && (
                  <div className="col-span-3">
                    <Input
                      value={data.title || ''}
                      onChange={(e) => updateModeChangeData(index, 'title', e.target.value)}
                      placeholder="제목 입력"
                      className="h-8"
                    />
                  </div>
                )}

                {(toMode === '학생' || toMode === '교사') && (
                  <div className="col-span-2">
                    <Select
                      value={data.grade || ''}
                      onValueChange={(value) => updateModeChangeData(index, 'grade', value as Grade)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map(grade => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(toMode === '학생' || toMode === '교사') && (
                  <div className="col-span-2">
                    <Input
                      value={data.subject || ''}
                      onChange={(e) => updateModeChangeData(index, 'subject', e.target.value)}
                      placeholder="과목"
                      className="h-8"
                    />
                  </div>
                )}

                {toMode === '교사' && (
                  <div className="col-span-2">
                    <Select
                      value={data.year?.toString() || ''}
                      onValueChange={(value) => updateModeChangeData(index, 'year', parseInt(value) as Year)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="연도" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {toMode === '교사' && (
                  <div className="col-span-2">
                    <Input
                      value={data.student || ''}
                      onChange={(e) => updateModeChangeData(index, 'student', e.target.value)}
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
            <Button variant="outline" onClick={onClose}>
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
                <DialogTitle>메모 미리보기</DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm">
                  {modeChangeData.find(d => d.memoId === showPreview)?.content}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
