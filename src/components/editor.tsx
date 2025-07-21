import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  EditorToolbar, 
  FontSize, 
  StarterKit, 
  TextAlign, 
  Highlight, 
  TextStyle, 
  FontFamily, 
  Color 
} from "@/components/editor-toolbar";
import {
  FilePlus,
  Save,
  Clock,
} from "lucide-react";
import { createNewMemo } from "@/lib/memo-utils";
import { getYears, getDefaultYear } from "@/lib/year-utils";
import type { Grade, Year, Memo } from "@/types";

const GRADES: Grade[] = ["고3", "고2", "고1", "중3", "중2", "중1", "초6", "초5", "초4", "초3", "초2", "초1"];
const YEARS = getYears();
const DEFAULT_YEAR = getDefaultYear();

export function Editor() {
  const {
    user,
    currentMemoId,
    currentFolderId,
    memos,
    updateMemo,
    addMemo,
    setCurrentMemoId,
    localMemo,
    setLocalMemo,
    isDraft,
    setIsDraft,
    lastSavedAt,
    setLastSavedAt,
    autoSaveInterval,
    isAutoSaved,
    setIsAutoSaved,
    preservedAttributes,
    setPreservedAttributes,
    clearPreservedAttributes,
  } = useAppStore();

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState<Grade | "">("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState<Year | "">(DEFAULT_YEAR);
  const [student, setStudent] = useState("");
  const [isNewFile, setIsNewFile] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const colorPaletteRef = useRef<HTMLDivElement>(null);

  // 폰트 UI 업데이트를 위한 강제 리렌더링 트리거
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const triggerUpdate = useCallback(() => setUpdateTrigger((prev) => prev + 1), []);

  // Select 컴포넌트 open 상태 관리
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);

  // 동적 에디터 높이 계산
  const [editorHeight, setEditorHeight] = useState("400px");

  const currentMemo = currentMemoId && currentMemoId !== "NEW_FILE" ? memos.find((m) => m.id === currentMemoId) : null;

  // Tiptap 에디터 초기화
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: "editor-paragraph",
          },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // 에디터에서 직접 변경된 내용만 state에 반영 (무한 루프 방지)
      handleContentChange(html);
    },
  });

  // 에디터 내용 업데이트 (외부에서 content가 변경된 경우에만)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 커서 위치를 보존하기 위해 현재 selection 저장
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content, { emitUpdate: false });

      // 가능한 경우 커서 위치 복원
      try {
        if (from <= editor.state.doc.content.size && to <= editor.state.doc.content.size) {
          editor.commands.setTextSelection({
            from: Math.min(from, editor.state.doc.content.size),
            to: Math.min(to, editor.state.doc.content.size),
          });
        }
      } catch {
        // 커서 위치 복원 실패 시 무시
      }
    }
  }, [editor, content]);

  // 에디터 상태 변경 시 UI 업데이트 트리거
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      triggerUpdate();
    };

    // 에디터 이벤트 리스너 등록
    editor.on("selectionUpdate", handleUpdate);
    editor.on("transaction", handleUpdate);
    editor.on("update", handleUpdate);

    return () => {
      editor.off("selectionUpdate", handleUpdate);
      editor.off("transaction", handleUpdate);
      editor.off("update", handleUpdate);
    };
  }, [editor, triggerUpdate]);

  // 동적 에디터 높이 계산
  useEffect(() => {
    const calculateEditorHeight = () => {
      const vh = window.innerHeight;

      // 헤더, 툴바, 푸터 등의 고정 높이 계산
      const headerHeight = user?.isLoggedIn ? 70 : 0; // 저장 버튼 헤더
      const toolbarHeight = 120; // 툴바 높이 (2줄)
      const footerHeight = 140; // 통계 푸터
      const paddingHeight = user?.isLoggedIn ? 48 : 48; // 패딩 (p-6 = 24px * 2)
      const modeFieldsHeight = user?.mode === "일반" ? 60 : user?.mode === "학생" ? 80 : user?.mode === "교사" ? 80 : 0;
      const containerPadding = 32; // 에디터 컨테이너 패딩 (p-4 = 16px * 2)

      const availableHeight =
        vh - headerHeight - toolbarHeight - footerHeight - paddingHeight - modeFieldsHeight - containerPadding;

      // 최소 높이 보장 (모바일: 300px, 데스크톱: 400px)
      const minHeight = window.innerWidth >= 768 ? 400 : 300;
      const calculatedHeight = Math.max(availableHeight, minHeight);

      setEditorHeight(`${calculatedHeight}px`);
    };

    // 초기 계산
    calculateEditorHeight();

    // 리사이즈 및 orientationchange 이벤트 리스너
    const handleResize = () => {
      // 키보드 열림/닫힘을 감지하기 위해 약간의 지연
      setTimeout(calculateEditorHeight, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    // Visual Viewport API를 사용하여 키보드 감지 (지원되는 경우)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, [user?.isLoggedIn, user?.mode, setEditorHeight]);

  // 현재 선택된 텍스트의 폰트 속성 확인 (일관성 체크)
  const getCurrentFontProperties = useCallback(() => {
    if (!editor) return { fontFamily: "system-ui", fontSize: "16px" };

    const { from, to } = editor.state.selection;

    if (from === to) {
      // 커서만 있는 경우
      const attributes = editor.getAttributes("textStyle");
      return {
        fontFamily: attributes.fontFamily || "system-ui",
        fontSize: attributes.fontSize || "16px",
      };
    }

    // 선택 범위의 모든 텍스트 노드에서 폰트 속성 수집
    const fontFamilies = new Set<string>();
    const fontSizes = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.state.doc.nodesBetween(from, to, (node: any) => {
      if (node.isText && node.marks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textStyleMark = node.marks.find((mark: any) => mark.type.name === "textStyle");
        if (textStyleMark) {
          const fontFamily = textStyleMark.attrs.fontFamily;
          const fontSize = textStyleMark.attrs.fontSize;

          if (fontFamily) fontFamilies.add(fontFamily);
          if (fontSize) fontSizes.add(fontSize);
        } else {
          // 마크가 없는 경우 기본값
          fontFamilies.add("system-ui");
          fontSizes.add("16px");
        }
      }
    });

    return {
      fontFamily: fontFamilies.size === 1 ? Array.from(fontFamilies)[0] : fontFamilies.size > 1 ? "mixed" : "system-ui",
      fontSize: fontSizes.size === 1 ? Array.from(fontSizes)[0] : fontSizes.size > 1 ? "mixed" : "16px",
    };
  }, [editor]);

  // 색상 팔레트 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPaletteRef.current && !colorPaletteRef.current.contains(event.target as Node)) {
        setShowColorPalette(false);
      }
    };

    if (showColorPalette) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showColorPalette]);

  // 창 닫기 전 경고
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDraft || isNewFile) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDraft, isNewFile]);

  // 복사 이벤트 핸들러 - 올바른 텍스트 형식으로 복사
  useEffect(() => {
    if (!editor) return;

    const handleCopy = (event: ClipboardEvent) => {
      const editorElement = editor.view.dom;
      if (!editorElement.contains(event.target as Node)) return;

      const { from, to } = editor.state.selection;
      if (from === to) return; // 선택된 텍스트가 없으면 기본 동작

      // 선택된 텍스트를 올바른 형식으로 가져오기
      const selectedText = editor.state.doc.textBetween(from, to);

      // 클립보드에 설정 (HTML 없이 순수 텍스트만)
      if (event.clipboardData) {
        event.clipboardData.setData("text/plain", selectedText);
        event.preventDefault();
      }
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, [editor]);

  // Helper functions
  const canSave = useCallback(() => {
    if (!user?.mode) return false;

    switch (user.mode) {
      case "일반":
        return title.trim() !== "" && content.trim() !== "";
      case "학생":
        return grade !== "" && subject.trim() !== "" && content.trim() !== "";
      case "교사":
        return year !== "" && grade !== "" && subject.trim() !== "" && student.trim() !== "" && content.trim() !== "";
      default:
        return false;
    }
  }, [user?.mode, title, content, grade, subject, year, student]);

  const handleSave = useCallback(() => {
    if (!canSave() || !user?.mode) return;

    if (isNewFile || !currentMemo) {
      // First save - create new memo
      const newMemo = createNewMemo(user.mode, content, {
        title: title,
        grade: grade as Grade,
        subject: subject,
        year: year as Year,
        student: student,
        folderId: user.mode === "일반" ? currentFolderId || undefined : undefined,
      });

      addMemo(newMemo);
      setCurrentMemoId(newMemo.id);
      setIsNewFile(false);
      setIsDraft(false);
    } else {
      // Update existing memo
      const updates: Partial<Memo> = {
        content,
        modifiedAt: new Date(),
      } as Partial<Memo>;

      if (user?.mode === "일반") {
        Object.assign(updates, { title });
      } else if (user?.mode === "학생") {
        Object.assign(updates, {
          grade: grade as Grade,
          subject,
          internalTitle: `${grade}-${subject}-${currentMemo.version}`,
          displayTitle: currentMemo.version > 1 ? `${subject}-${currentMemo.version}` : subject,
        });
      } else if (user?.mode === "교사") {
        Object.assign(updates, {
          year: year as Year,
          grade: grade as Grade,
          subject,
          student,
          internalTitle: `${year}-${grade}-${subject}-${student}-${currentMemo.version}`,
          displayTitle: student,
        });
      }

      updateMemo(currentMemo.id, updates);
      setIsDraft(false);
    }

    setLastSavedAt(new Date());
    setIsAutoSaved(false); // 수동 저장

    // 저장 완료 후 보존된 속성 지우기
    clearPreservedAttributes();
  }, [
    canSave,
    currentMemo,
    isNewFile,
    content,
    title,
    grade,
    subject,
    year,
    student,
    user?.mode,
    currentFolderId,
    addMemo,
    setCurrentMemoId,
    setIsNewFile,
    setIsDraft,
    updateMemo,
    setLastSavedAt,
    setIsAutoSaved,
    clearPreservedAttributes,
  ]);

  // 키보드 단축키 - Ctrl+S (Cmd+S) 저장 기능
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S (Windows/Linux) 또는 Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault(); // 기본 브라우저 저장 동작 방지
        if (canSave()) {
          handleSave();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canSave, handleSave]);

  const handleCreateNewFile = () => {
    if (!user || !user.mode) return;

    // 새 파일 상태로 전환하고 필드들 초기화
    setIsNewFile(true);
    setCurrentMemoId(null);
    setContent("");
    setIsDraft(false); // 새 파일은 draft가 아님

    // 보존된 속성이 있으면 즉시 복원
    if (preservedAttributes) {
      if (user.mode === "일반" && preservedAttributes.title) {
        setTitle(preservedAttributes.title);
      } else {
        setTitle("");
      }

      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.grade) {
        setGrade(preservedAttributes.grade as Grade);
      } else {
        setGrade("");
      }

      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.subject) {
        setSubject(preservedAttributes.subject);
      } else {
        setSubject("");
      }

      if (user.mode === "교사" && preservedAttributes.year) {
        setYear(preservedAttributes.year as Year);
      } else if (user.mode !== "교사") {
        setYear(DEFAULT_YEAR);
      }

      if (user.mode === "교사" && preservedAttributes.student) {
        setStudent(preservedAttributes.student);
      } else {
        setStudent("");
      }
    } else {
      // 보존된 속성이 없으면 기본값으로 초기화
      setTitle("");
      setGrade("");
      setSubject("");
      setYear(DEFAULT_YEAR);
      setStudent("");
    }
  };

  // Initialize state from current memo
  useEffect(() => {
    if (currentMemoId === "NEW_FILE") {
      // 새 파일 생성 트리거
      setIsNewFile(true);
      setCurrentMemoId(null);
      setContent("");
      setTitle("");
      setGrade("");
      setSubject("");
      setYear(DEFAULT_YEAR);
      setStudent("");
      setIsDraft(false);
    } else if (currentMemo) {
      setContent(currentMemo.content);
      setIsNewFile(false);
      setIsDraft(false);
      if (currentMemo.mode === "일반") {
        setTitle(currentMemo.title);
      } else if (currentMemo.mode === "학생") {
        setGrade(currentMemo.grade);
        setSubject(currentMemo.subject);
      } else if (currentMemo.mode === "교사") {
        setYear(currentMemo.year);
        setGrade(currentMemo.grade);
        setSubject(currentMemo.subject);
        setStudent(currentMemo.student);
      }
    } else if (!user?.isLoggedIn) {
      setContent(localMemo);
      setIsNewFile(false);
    } else if (!isNewFile) {
      // Reset all fields when no memo is selected and not in new file mode
      setContent("");
      setTitle("");
      setSubject("");
      setStudent("");
      setGrade("");
      setYear(DEFAULT_YEAR);
      setIsDraft(false);
    }
  }, [currentMemo, currentMemoId, localMemo, user, isNewFile, setIsDraft, setCurrentMemoId]);

  // Save current form data when user mode changes
  useEffect(() => {
    if (!user?.mode) return;

    // Save current form data to preserved attributes when mode might change
    const currentAttributes = {
      title: title.trim() || undefined,
      year: year || undefined,
      grade: grade || undefined,
      subject: subject.trim() || undefined,
      student: student.trim() || undefined,
    };

    // Only save if we have some data to preserve
    if (Object.values(currentAttributes).some((val) => val !== undefined && val !== "")) {
      setPreservedAttributes(currentAttributes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.mode, setPreservedAttributes]);

  // Restore preserved attributes when starting new file or mode changes
  useEffect(() => {
    // 새 파일이거나 현재 메모가 없을 때 보존된 속성 복원
    if ((isNewFile || !currentMemo) && user?.mode && preservedAttributes) {
      // Restore attributes based on current mode
      if (user.mode === "일반" && preservedAttributes.title && !title.trim()) {
        setTitle(preservedAttributes.title);
      }
      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.grade && !grade) {
        setGrade(preservedAttributes.grade as Grade);
      }
      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.subject && !subject.trim()) {
        setSubject(preservedAttributes.subject);
      }
      if (user.mode === "교사" && preservedAttributes.year && !year) {
        setYear(preservedAttributes.year as Year);
      }
      if (user.mode === "교사" && preservedAttributes.student && !student.trim()) {
        setStudent(preservedAttributes.student);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewFile, currentMemo, user?.mode, preservedAttributes]);

  // Auto-save functionality
  useEffect(() => {
    if (!isDraft || isNewFile || autoSaveInterval === 0) return; // 자동 저장이 꺼져있거나 새 파일인 경우 자동 저장하지 않음

    const autoSaveTimer = setTimeout(() => {
      if (currentMemo) {
        setIsAutoSaved(true); // 자동 저장 표시
        handleSave();
      }
    }, autoSaveInterval * 60 * 1000); // Convert minutes to milliseconds

    return () => clearTimeout(autoSaveTimer);
  }, [
    content,
    title,
    grade,
    subject,
    year,
    student,
    autoSaveInterval,
    isDraft,
    isNewFile,
    currentMemo,
    handleSave,
    setIsAutoSaved,
  ]);

  const handleContentChange = useCallback(
    (value: string) => {
      // 이미 같은 값이면 업데이트하지 않음
      if (value === content) return;

      setContent(value);
      if (isNewFile && value.trim() !== "") {
        setIsDraft(true); // 새 파일에서 내용을 입력하기 시작하면 draft 상태로 변경
      } else if (!isNewFile) {
        setIsDraft(true);
      }

      if (!user?.isLoggedIn) {
        setLocalMemo(value);
      }
    },
    [content, isNewFile, setIsDraft, user?.isLoggedIn, setLocalMemo]
  );

  const handleFieldChange = (field: string, value: string | Grade | Year) => {
    if (isNewFile && value !== "") {
      setIsDraft(true); // 새 파일에서 필드를 입력하기 시작하면 draft 상태로 변경
    } else if (!isNewFile) {
      setIsDraft(true);
    }

    // 학생 모드에서 학년이나 과목이 변경되면 기존 교사 속성 제거
    if (user?.mode === "학생" && (field === "grade" || field === "subject")) {
      const currentGrade = field === "grade" ? value : grade;
      const currentSubject = field === "subject" ? value : subject;

      // 기존에 보존된 교사 속성이 있고, 현재 학년/과목과 다르면 교사 속성 제거
      if (preservedAttributes.year && preservedAttributes.student) {
        if (preservedAttributes.grade !== currentGrade || preservedAttributes.subject !== currentSubject) {
          setPreservedAttributes({
            ...preservedAttributes,
            year: undefined,
            student: undefined,
          });
        }
      }
    }

    switch (field) {
      case "title":
        setTitle(value as string);
        break;
      case "grade":
        setGrade(value as Grade);
        break;
      case "subject":
        setSubject(value as string);
        break;
      case "year":
        setYear(value as Year);
        break;
      case "student":
        setStudent(value as string);
        break;
    }
  };

  // HTML을 plaintext로 변환하는 유틸리티 함수
  const htmlToPlainText = (html: string) => {
    if (!html) return "";

    return (
      html
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")  // <p> 태그 사이를 줄바꿈으로 변환
        .replace(/^<p[^>]*>/i, "")  // 첫 번째 <p> 태그 제거
        .replace(/<\/p>$/i, "")  // 마지막 </p> 태그 제거
        .replace(/<p[^>]*>/gi, "\n")  // 남은 <p> 태그들을 줄바꿈으로 변환
        .replace(/<\/p>/gi, "")  // 남은 </p> 태그 제거
        .replace(/<br\s*\/?>/gi, "\n")  // <br> 태그를 줄바꿈으로 변환
        .replace(/<[^>]*>/g, "")  // 나머지 모든 HTML 태그 제거
        // HTML 엔티티 디코딩
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
  };

  const getWordCount = (text: string) => {
    // HTML을 plaintext로 변환 후 단어 수 계산
    const plainText = htmlToPlainText(text);
    const words = plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const charactersWithSpaces = plainText.length;
    const charactersWithoutSpaces = plainText.replace(/\s/g, "").length;

    return { words, charactersWithSpaces, charactersWithoutSpaces };
  };

  const getByteCount = (content: string) => {
    if (!content) return 0;

    // HTML을 plaintext로 변환
    const plainText = htmlToPlainText(content);

    let byteCount = 0;

    for (let i = 0; i < plainText.length; i++) {
      const char = plainText[i];

      // 엔터키 (줄바꿈) - 2바이트
      if (char === "\n") {
        byteCount += 2;
      }
      // 한글 - 3바이트 (한글 유니코드 범위: 가-힣, ㄱ-ㅎ, ㅏ-ㅣ)
      else if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(char)) {
        byteCount += 3;
      }
      // 영어, 숫자, 특수문자, 띄어쓰기 - 1바이트
      else {
        byteCount += 1;
      }
    }

    return byteCount;
  };

  const getTimeSinceLastSave = () => {
    if (!lastSavedAt) return "";

    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSavedAt.getTime()) / (1000 * 60));

    if (diffInMinutes === 0) return "방금 전";
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return "1시간 전";
    return `${diffInHours}시간 전`;
  };

  const wordCount = getWordCount(content);
  const byteCount = getByteCount(content);

  // Show empty state when no memo is selected and not in new file mode
  if (!currentMemo && !isNewFile && user?.isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-4">새 파일을 만들어 시작하세요</h3>
          <Button onClick={handleCreateNewFile} size="lg">
            <FilePlus className="h-5 w-5 mr-2" />새 파일
          </Button>
        </div>
      </div>
    );
  }

  // Non-logged in user view
  if (!user?.isLoggedIn) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                로그인하지 않은 상태에서는 하나의 파일만 작성할 수 있습니다.
              </p>
            </div>

            {/* Rich Text Toolbar for non-logged in users */}
            <EditorToolbar
              editor={editor}
              updateTrigger={updateTrigger}
              triggerUpdate={triggerUpdate}
              fontFamilyOpen={fontFamilyOpen}
              setFontFamilyOpen={setFontFamilyOpen}
              fontSizeOpen={fontSizeOpen}
              setFontSizeOpen={setFontSizeOpen}
              showColorPalette={showColorPalette}
              setShowColorPalette={setShowColorPalette}
              getCurrentFontProperties={getCurrentFontProperties}
            />
            </div>
          </div>

        <div className="border rounded-lg p-4 flex flex-col" style={{ height: editorHeight }}>
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none focus:outline-none flex-1 [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none [&_.ProseMirror]:h-full [&_.ProseMirror]:overflow-auto"
          />
        </div>

        <div className="border-t bg-card p-4">
          <div className="text-right text-accented-foreground space-y-1">
            <div className="text-2xl font-bold tabular-nums">{byteCount.toLocaleString()} 바이트</div>
            <div className="text-md tabular-nums">단어 {wordCount.words.toLocaleString()} 개</div>
            <div className="text-md tabular-nums">공백 포함 {wordCount.charactersWithSpaces.toLocaleString()} 자</div>
            <div className="text-md tabular-nums">
              공백 제외 {wordCount.charactersWithoutSpaces.toLocaleString()} 자
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main editor view
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header with save button and auto-save status */}
      <div className="border-b bg-card px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSave}
              disabled={!canSave()}
              variant={isDraft || isNewFile ? "default" : "outline"}
              className="h-9 disabled:bg-muted disabled:text-muted-foreground disabled:border-border"
            >
              <Save className="h-4 w-4 mr-2" />
              저장
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {autoSaveInterval === 0
              ? "자동 저장 비활성화됨"
              : lastSavedAt
              ? `${isAutoSaved ? "자동 저장됨" : "저장됨"}: ${getTimeSinceLastSave()}`
              : "아직 저장되지 않음"}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollable">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header fields based on mode */}
            {user.mode === "일반" && (
              <div className="mb-4 md:mb-6">
                <Input
                  value={title}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  placeholder="제목 없음"
                  className="text-lg font-medium"
                />
              </div>
            )}

            {user.mode === "학생" && (
              <div className="mb-4 md:mb-6 flex justify-start">
                <div className="flex items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">학년</label>
                    <Select value={grade} onValueChange={(value) => handleFieldChange("grade", value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                      <SelectContent className="w-24 min-w-24">
                        {GRADES.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">과목</label>
                    <Input
                      value={subject}
                      onChange={(e) => handleFieldChange("subject", e.target.value)}
                      placeholder="과목 입력"
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            )}

            {user.mode === "교사" && (
              <div className="mb-4 md:mb-6 flex justify-start">
                <div className="flex items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">학년도</label>
                    <Select
                      value={year ? year.toString() : ""}
                      onValueChange={(value) => handleFieldChange("year", parseInt(value) as Year)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="학년도" />
                      </SelectTrigger>
                      <SelectContent className="w-24 min-w-24">
                        {YEARS.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">학년</label>
                    <Select value={grade} onValueChange={(value) => handleFieldChange("grade", value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="학년" />
                      </SelectTrigger>
                      <SelectContent className="w-24 min-w-24">
                        {GRADES.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">과목</label>
                    <Input
                      value={subject}
                      onChange={(e) => handleFieldChange("subject", e.target.value)}
                      placeholder="과목 입력"
                      className="w-32"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">학생</label>
                    <Input
                      value={student}
                      onChange={(e) => handleFieldChange("student", e.target.value)}
                      placeholder="이름 입력"
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rich Text Toolbar */}
            <EditorToolbar
              editor={editor}
              updateTrigger={updateTrigger}
              triggerUpdate={triggerUpdate}
              fontFamilyOpen={fontFamilyOpen}
              setFontFamilyOpen={setFontFamilyOpen}
              fontSizeOpen={fontSizeOpen}
              setFontSizeOpen={setFontSizeOpen}
              showColorPalette={showColorPalette}
              setShowColorPalette={setShowColorPalette}
              getCurrentFontProperties={getCurrentFontProperties}
            />

            {/* Tiptap Editor */}
            <div className="border rounded-lg p-4 flex flex-col" style={{ height: editorHeight }}>
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none focus:outline-none flex-1 [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none [&_.ProseMirror]:h-full [&_.ProseMirror]:overflow-auto"
              />
            </div>
          </div>
        </div>

        <div className="border-t bg-card p-4">
          <div className="text-right text-accented-foreground space-y-1">
            <div className="text-2xl font-bold tabular-nums">{byteCount.toLocaleString()} 바이트</div>
            <div className="text-md tabular-nums">단어 {wordCount.words.toLocaleString()} 개</div>
            <div className="text-md tabular-nums">공백 포함 {wordCount.charactersWithSpaces.toLocaleString()} 자</div>
            <div className="text-md tabular-nums">
              공백 제외 {wordCount.charactersWithoutSpaces.toLocaleString()} 자
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
