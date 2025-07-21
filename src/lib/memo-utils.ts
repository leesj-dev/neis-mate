import type { Memo, GeneralMemo, StudentMemo, TeacherMemo, UserMode, Grade, Year } from '@/types';

export function generateMemoId(): string {
  return `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createInternalTitle(
  mode: UserMode,
  options: {
    title?: string;
    grade?: Grade;
    subject?: string;
    year?: Year;
    student?: string;
    version?: number;
  }
): string {
  const { title, grade, subject, year, student, version = 1 } = options;

  switch (mode) {
    case '일반':
      return title || '';
    case '학생':
      return `${grade}-${subject}-${version}`;
    case '교사':
      return `${year}-${grade}-${subject}-${student}-${version}`;
    default:
      return '';
  }
}

export function createDisplayTitle(
  mode: UserMode,
  options: {
    title?: string;
    subject?: string;
    student?: string;
    version?: number;
  }
): string {
  const { title, subject, student, version = 1 } = options;

  switch (mode) {
    case '일반':
      return title || '';
    case '학생':
      return version > 1 ? `${subject}-${version}` : subject || '';
    case '교사':
      return student || '';
    default:
      return '';
  }
}

export function createNewMemo(
  mode: UserMode,
  content: string = '',
  options: {
    title?: string;
    grade?: Grade;
    subject?: string;
    year?: Year;
    student?: string;
    folderId?: string;
  } = {}
): Memo {
  const baseProps = {
    id: generateMemoId(),
    content,
    createdAt: new Date(),
    modifiedAt: new Date(),
    viewedAt: new Date(),
    version: 1,
  };

  switch (mode) {
    case '일반':
      return {
        ...baseProps,
        mode: '일반',
        title: options.title || '',
        folderId: options.folderId,
      } as GeneralMemo;

    case '학생':
      const studentInternalTitle = createInternalTitle(mode, options);
      const studentDisplayTitle = createDisplayTitle(mode, options);
      return {
        ...baseProps,
        mode: '학생',
        grade: options.grade || '중1',
        subject: options.subject || '',
        internalTitle: studentInternalTitle,
        displayTitle: studentDisplayTitle,
      } as StudentMemo;

    case '교사':
      const teacherInternalTitle = createInternalTitle(mode, options);
      const teacherDisplayTitle = createDisplayTitle(mode, options);
      return {
        ...baseProps,
        mode: '교사',
        year: options.year || 2024,
        grade: options.grade || '중1',
        subject: options.subject || '',
        student: options.student || '',
        internalTitle: teacherInternalTitle,
        displayTitle: teacherDisplayTitle,
      } as TeacherMemo;

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

export function createNewVersion(memo: Memo): Memo {
  const newVersion = memo.version + 1;
  const newId = generateMemoId();

  switch (memo.mode) {
    case '일반':
      return {
        ...memo,
        id: newId,
        title: `${memo.title}-${newVersion}`,
        version: newVersion,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as GeneralMemo;

    case '학생':
      const studentMemo = memo as StudentMemo;
      const newStudentInternalTitle = createInternalTitle(memo.mode, {
        grade: studentMemo.grade,
        subject: studentMemo.subject,
        version: newVersion,
      });
      const newStudentDisplayTitle = createDisplayTitle(memo.mode, {
        subject: studentMemo.subject,
        version: newVersion,
      });
      return {
        ...studentMemo,
        id: newId,
        internalTitle: newStudentInternalTitle,
        displayTitle: newStudentDisplayTitle,
        version: newVersion,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as StudentMemo;

    case '교사':
      const teacherMemo = memo as TeacherMemo;
      const newTeacherInternalTitle = createInternalTitle(memo.mode, {
        year: teacherMemo.year,
        grade: teacherMemo.grade,
        subject: teacherMemo.subject,
        student: teacherMemo.student,
        version: newVersion,
      });
      return {
        ...teacherMemo,
        id: newId,
        internalTitle: newTeacherInternalTitle,
        version: newVersion,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as TeacherMemo;

    default:
      throw new Error(`Unknown mode: ${memo.mode}`);
  }
}

export function duplicateMemo(memo: Memo): Memo {
  const newId = generateMemoId();

  switch (memo.mode) {
    case '일반':
      return {
        ...memo,
        id: newId,
        title: `${memo.title} 사본`,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as GeneralMemo;

    case '학생':
      return {
        ...memo,
        id: newId,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as StudentMemo;

    case '교사':
      return {
        ...memo,
        id: newId,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as TeacherMemo;

    default:
      throw new Error(`Unknown mode: ${memo.mode}`);
  }
}

export function getDownloadFileName(memo: Memo): string {
  switch (memo.mode) {
    case '일반':
      return `${memo.title}.txt`;
    case '학생':
    case '교사':
      return `${memo.internalTitle}.txt`;
    default:
      return 'memo.txt';
  }
}

export function countWords(text: string): {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
} {
  const words = text.trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
  
  const charactersWithSpaces = text.length;
  const charactersWithoutSpaces = text.replace(/\s/g, '').length;
  
  return {
    words: text.trim() === '' ? 0 : words,
    charactersWithSpaces,
    charactersWithoutSpaces,
  };
}
