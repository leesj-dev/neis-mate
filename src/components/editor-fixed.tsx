import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Grade, Year, Memo } from '@/types';

const GRADES: Grade[] = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const YEARS: Year[] = [2021, 2022, 2023, 2024, 2025];

export function Editor() {
  const { user, currentMemoId, memos, updateMemo, localMemo, setLocalMemo } = useAppStore();
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<Grade>('중1');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState<Year>(2024);
  const [student, setStudent] = useState('');

  const currentMemo = currentMemoId ? memos.find(m => m.id === currentMemoId) : null;

  useEffect(() => {
    if (currentMemo) {
      setContent(currentMemo.content);
      if (currentMemo.mode === '일반') {
        setTitle(currentMemo.title);
      } else if (currentMemo.mode === '학생') {
        setGrade(currentMemo.grade);
        setSubject(currentMemo.subject);
      } else if (currentMemo.mode === '교사') {
        setYear(currentMemo.year);
        setGrade(currentMemo.grade);
        setSubject(currentMemo.subject);
        setStudent(currentMemo.student);
      }
    } else if (!user?.isLoggedIn) {
      setContent(localMemo);
    } else {
      setContent('');
      setTitle('');
      setSubject('');
      setStudent('');
    }
  }, [currentMemo, localMemo, user]);

  const handleContentChange = (value: string) => {
    setContent(value);
    
    if (!user?.isLoggedIn) {
      setLocalMemo(value);
    } else if (currentMemoId) {
      updateMemo(currentMemoId, { content: value });
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (currentMemoId && user?.mode === '일반') {
      // Check for duplicate titles
      const existingMemo = memos.find((m: Memo) => 
        m.mode === '일반' && m.title === value && m.id !== currentMemoId
      );
      if (existingMemo) {
        // Don't update if title would be duplicate - user needs to change it
        return;
      }
      updateMemo(currentMemoId, { title: value });
    }
  };

  const handleGradeChange = (value: Grade) => {
    setGrade(value);
    if (currentMemoId && (user?.mode === '학생' || user?.mode === '교사')) {
      const updates: Partial<Memo> = { grade: value };
      if (user.mode === '학생') {
        Object.assign(updates, { internalTitle: `${value}-${subject}-${currentMemo?.version || 1}` });
      } else if (user.mode === '교사') {
        Object.assign(updates, { internalTitle: `${year}-${value}-${subject}-${student}-${currentMemo?.version || 1}` });
      }
      updateMemo(currentMemoId, updates);
    }
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    if (currentMemoId && (user?.mode === '학생' || user?.mode === '교사')) {
      const updates: Partial<Memo> = { subject: value };
      if (user.mode === '학생') {
        Object.assign(updates, { 
          internalTitle: `${grade}-${value}-${currentMemo?.version || 1}`,
          displayTitle: currentMemo?.version && currentMemo.version > 1 ? `${value}-${currentMemo.version}` : value
        });
      } else if (user.mode === '교사') {
        Object.assign(updates, { internalTitle: `${year}-${grade}-${value}-${student}-${currentMemo?.version || 1}` });
      }
      updateMemo(currentMemoId, updates);
    }
  };

  const handleYearChange = (value: Year) => {
    setYear(value);
    if (currentMemoId && user?.mode === '교사') {
      const updates = {
        year: value,
        internalTitle: `${value}-${grade}-${subject}-${student}-${currentMemo?.version || 1}`,
      };
      updateMemo(currentMemoId, updates);
    }
  };

  const handleStudentChange = (value: string) => {
    setStudent(value);
    if (currentMemoId && user?.mode === '교사') {
      const updates = {
        student: value,
        internalTitle: `${year}-${grade}-${subject}-${value}-${currentMemo?.version || 1}`,
        displayTitle: value,
      };
      updateMemo(currentMemoId, updates);
    }
  };

  const getWordCount = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const charactersWithSpaces = text.length;
    const charactersWithoutSpaces = text.replace(/\s/g, '').length;
    
    return { words, charactersWithSpaces, charactersWithoutSpaces };
  };

  const wordCount = getWordCount(content);

  if (!user?.isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                로그인하지 않은 상태에서는 하나의 메모만 작성할 수 있습니다.
              </p>
            </div>
            
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="메모를 작성하세요..."
              className="min-h-[500px] resize-none"
            />
          </div>
        </div>
        
        <div className="border-t bg-card p-4">
          <div className="text-right text-sm text-muted-foreground">
            단어: {wordCount.words} | 문자(공백 포함): {wordCount.charactersWithSpaces} | 문자(공백 제외): {wordCount.charactersWithoutSpaces}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header fields based on mode */}
          {user.mode === '일반' && (
            <div className="mb-6">
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="제목을 입력하세요..."
                className="text-lg font-medium"
              />
            </div>
          )}
          
          {user.mode === '학생' && (
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">학년</label>
                <Select value={grade} onValueChange={handleGradeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">과목</label>
                <Input
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  placeholder="과목을 입력하세요..."
                />
              </div>
            </div>
          )}
          
          {user.mode === '교사' && (
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">연도</label>
                <Select value={year.toString()} onValueChange={(value) => handleYearChange(parseInt(value) as Year)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">학년</label>
                <Select value={grade} onValueChange={handleGradeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">과목</label>
                <Input
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  placeholder="과목을 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">학생</label>
                <Input
                  value={student}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  placeholder="학생 이름을 입력하세요..."
                />
              </div>
            </div>
          )}
          
          <Textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="메모를 작성하세요..."
            className="min-h-[500px] resize-none"
          />
        </div>
      </div>
      
      <div className="border-t bg-card p-4">
        <div className="text-right text-sm text-muted-foreground">
          단어: {wordCount.words} | 문자(공백 포함): {wordCount.charactersWithSpaces} | 문자(공백 제외): {wordCount.charactersWithoutSpaces}
        </div>
      </div>
    </div>
  );
}
