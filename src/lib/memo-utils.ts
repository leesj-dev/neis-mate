import { getDefaultYear } from "./year-utils";
import type { Memo, UserMode, GeneralMemo, StudentMemo, TeacherMemo, Grade, Year } from "@/types";

export function generateMemoId(): string {
  return `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 메모의 베이스 식별자를 생성 (버전 번호 제외)
export function getMemoBaseIdentifier(memo: Memo): string {
  switch (memo.mode) {
    case "일반":
      return memo.title.replace(/-\d+$/, ""); // 끝의 -숫자 제거
    case "학생": {
      const studentMemo = memo as StudentMemo;
      return `${studentMemo.grade}-${studentMemo.subject}`;
    }
    case "교사": {
      const teacherMemo = memo as TeacherMemo;
      return `${teacherMemo.year}-${teacherMemo.grade}-${teacherMemo.subject}-${teacherMemo.student}`;
    }
    default:
      return "";
  }
}

// 같은 베이스를 가진 메모들을 필터링
export function getRelatedMemos(targetMemo: Memo, allMemos: Memo[]): Memo[] {
  const baseIdentifier = getMemoBaseIdentifier(targetMemo);
  
  return allMemos.filter(memo => {
    if (memo.mode !== targetMemo.mode) return false;
    
    switch (memo.mode) {
      case "일반":
        return getMemoBaseIdentifier(memo) === baseIdentifier;
      case "학생": {
        const studentMemo = memo as StudentMemo;
        const targetStudentMemo = targetMemo as StudentMemo;
        return studentMemo.grade === targetStudentMemo.grade && 
               studentMemo.subject === targetStudentMemo.subject;
      }
      case "교사": {
        const teacherMemo = memo as TeacherMemo;
        const targetTeacherMemo = targetMemo as TeacherMemo;
        return teacherMemo.year === targetTeacherMemo.year &&
               teacherMemo.grade === targetTeacherMemo.grade &&
               teacherMemo.subject === targetTeacherMemo.subject &&
               teacherMemo.student === targetTeacherMemo.student;
      }
      default:
        return false;
    }
  });
}

// 다음 사용 가능한 버전 번호를 찾기
export function getNextAvailableVersion(targetMemo: Memo, allMemos: Memo[]): number {
  const relatedMemos = getRelatedMemos(targetMemo, allMemos);
  const usedVersions = relatedMemos.map(memo => memo.version).sort((a, b) => a - b);
  
  // 1부터 시작해서 첫 번째 사용 가능한 번호 찾기
  for (let i = 1; i <= usedVersions.length + 1; i++) {
    if (!usedVersions.includes(i)) {
      return i;
    }
  }
  
  // 모든 번호가 사용 중이면 마지막 + 1
  return Math.max(...usedVersions, 0) + 1;
}

// 버전 번호 재정렬 (삭제 후 호출)
export function reorderVersionNumbers(deletedMemo: Memo, allMemos: Memo[]): Memo[] {
  const relatedMemos = getRelatedMemos(deletedMemo, allMemos)
    .filter(memo => memo.id !== deletedMemo.id) // 삭제될 메모 제외
    .sort((a, b) => a.version - b.version); // 버전 순으로 정렬
  
  const updatedMemos: Memo[] = [...allMemos];
  
  // 관련 메모들의 버전을 1, 2, 3... 순으로 재정렬
  relatedMemos.forEach((memo, index) => {
    const newVersion = index + 1;
    if (memo.version !== newVersion) {
      const memoIndex = updatedMemos.findIndex(m => m.id === memo.id);
      if (memoIndex !== -1) {
        const updatedMemo = { ...memo, version: newVersion };
        
        // internalTitle과 displayTitle 업데이트
        if (memo.mode === "학생") {
          const studentMemo = updatedMemo as StudentMemo;
          studentMemo.internalTitle = createInternalTitle(memo.mode, {
            grade: studentMemo.grade,
            subject: studentMemo.subject,
            version: newVersion,
          });
          studentMemo.displayTitle = createDisplayTitle(memo.mode, {
            subject: studentMemo.subject,
            version: newVersion,
          });
        } else if (memo.mode === "교사") {
          const teacherMemo = updatedMemo as TeacherMemo;
          teacherMemo.internalTitle = createInternalTitle(memo.mode, {
            year: teacherMemo.year,
            grade: teacherMemo.grade,
            subject: teacherMemo.subject,
            student: teacherMemo.student,
            version: newVersion,
          });
        } else if (memo.mode === "일반") {
          const generalMemo = updatedMemo as GeneralMemo;
          const baseTitle = getMemoBaseIdentifier(memo);
          generalMemo.title = newVersion === 1 ? baseTitle : `${baseTitle}-${newVersion}`;
        }
        
        updatedMemos[memoIndex] = updatedMemo;
      }
    }
  });
  
  return updatedMemos;
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
    case "일반":
      return title || "";
    case "학생":
      return `${grade}-${subject}-${version}`;
    case "교사":
      return `${year}-${grade}-${subject}-${student}-${version}`;
    default:
      return "";
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
    case "일반":
      return title || "";
    case "학생":
      return version > 1 ? `${subject}-${version}` : subject || "";
    case "교사":
      return student || "";
    default:
      return "";
  }
}

export function createNewMemo(
  mode: UserMode,
  content: string = "",
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
    case "일반":
      return {
        ...baseProps,
        mode: "일반",
        title: options.title || "",
        folderId: options.folderId,
      } as GeneralMemo;

    case "학생": {
      const studentInternalTitle = createInternalTitle(mode, options);
      const studentDisplayTitle = createDisplayTitle(mode, options);
      return {
        ...baseProps,
        mode: "학생",
        grade: options.grade || "중1",
        subject: options.subject || "",
        internalTitle: studentInternalTitle,
        displayTitle: studentDisplayTitle,
      } as StudentMemo;
    }
    case "교사": {
      const teacherInternalTitle = createInternalTitle(mode, options);
      const teacherDisplayTitle = createDisplayTitle(mode, options);
      return {
        ...baseProps,
        mode: "교사",
        year: options.year || getDefaultYear(),
        grade: options.grade || "중1",
        subject: options.subject || "",
        student: options.student || "",
        internalTitle: teacherInternalTitle,
        displayTitle: teacherDisplayTitle,
      } as TeacherMemo;
    }
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

export function createNewVersion(memo: Memo, allMemos: Memo[]): Memo {
  const newVersion = getNextAvailableVersion(memo, allMemos);
  const newId = generateMemoId();

  switch (memo.mode) {
    case "일반": {
      const baseTitle = getMemoBaseIdentifier(memo);
      const title = newVersion === 1 ? baseTitle : `${baseTitle}-${newVersion}`;
      return {
        ...memo,
        id: newId,
        title,
        version: newVersion,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as GeneralMemo;
    }

    case "학생": {
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
    }

    case "교사": {
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
    }

    default:
      throw new Error(`Unknown mode: ${(memo as Memo).mode}`);
  }
}

export function duplicateMemo(memo: Memo): Memo {
  const newId = generateMemoId();

  switch (memo.mode) {
    case "일반":
      return {
        ...memo,
        id: newId,
        title: `${memo.title} 사본`,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as GeneralMemo;

    case "학생":
      return {
        ...memo,
        id: newId,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as StudentMemo;

    case "교사":
      return {
        ...memo,
        id: newId,
        createdAt: new Date(),
        modifiedAt: new Date(),
        viewedAt: new Date(),
      } as TeacherMemo;

    default:
      throw new Error(`Unknown mode: ${(memo as Memo).mode}`);
  }
}

/**
 * HTML 콘텐츠를 Plain Text 형식으로 변환
 */
export function htmlToPlainText(html: string): string {
  try {
    // HTML 태그 제거 및 텍스트 정리
    const text = html
      // 단락 태그를 줄바꿈으로 변환 (시작 태그 제거, 종료 태그는 줄바꿈으로)
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<h[1-6][^>]*>/gi, '')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<br[^>]*\/?>/gi, '\n')
      // 리스트 태그 처리
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      // 모든 나머지 HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // HTML 엔티티 디코딩
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // 연속된 줄바꿈 정리
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 각 줄의 앞뒤 공백 제거
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // 앞뒤 공백 제거
      .trim();
    
    return text;
  } catch (error) {
    console.error('Plain text 변환 중 오류 발생:', error);
    // 폴백: 간단한 태그 제거
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

export function getDownloadFileName(memo: Memo): string {
  switch (memo.mode) {
    case "일반":
      return `${memo.title}.txt`;
    case "학생":
    case "교사":
      return `${memo.internalTitle}.txt`;
    default:
      return "memo.txt";
  }
}

export function countWords(text: string): {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
} {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const charactersWithSpaces = text.length;
  const charactersWithoutSpaces = text.replace(/\s/g, "").length;

  return {
    words: text.trim() === "" ? 0 : words,
    charactersWithSpaces,
    charactersWithoutSpaces,
  };
}
