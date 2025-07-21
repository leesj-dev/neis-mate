export type UserMode = "일반" | "학생" | "교사";

export type Grade = "초1" | "초2" | "초3" | "초4" | "초5" | "초6" | "중1" | "중2" | "중3" | "고1" | "고2" | "고3";

export type Year = 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | 2027 | 2028 | 2029 | 2030;

export interface BaseMemo {
  id: string;
  content: string;
  createdAt: Date;
  modifiedAt: Date;
  viewedAt: Date;
  version: number;
}

export interface GeneralMemo extends BaseMemo {
  mode: "일반";
  title: string;
  folderId?: string;
}

export interface StudentMemo extends BaseMemo {
  mode: "학생";
  grade: Grade;
  subject: string;
  internalTitle: string; // grade-subject-version
  displayTitle: string; // subject with version suffix
}

export interface TeacherMemo extends BaseMemo {
  mode: "교사";
  year: Year;
  grade: Grade;
  subject: string;
  student: string;
  internalTitle: string; // year-grade-subject-student-version
  displayTitle: string; // student name
}

export type Memo = GeneralMemo | StudentMemo | TeacherMemo;

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: Date;
  googleDriveId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  mode?: UserMode;
  isLoggedIn: boolean;
  accessToken?: string;
  googleId?: string;
}

export type SortOption = "alphabetical" | "recently-modified" | "recently-created" | "recently-viewed";

export interface WordCount {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
}

export interface ModeChangeData {
  memoId: string;
  currentTitle: string;
  content: string;
  year?: Year;
  grade?: Grade;
  subject?: string;
  student?: string;
  title?: string;
}
