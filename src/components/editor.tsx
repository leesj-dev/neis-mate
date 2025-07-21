import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FilePlus,
  Save,
  Clock,
  Undo,
  Redo,
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { createNewMemo } from "@/lib/memo-utils";
import { getYears, getDefaultYear } from "@/lib/year-utils";
import type { Grade, Year, Memo } from "@/types";

const GRADES: Grade[] = ["고3", "고2", "고1", "중3", "중2", "중1", "초6", "초5", "초4", "초3", "초2", "초1"];
const YEARS = getYears();
const DEFAULT_YEAR = getDefaultYear();

// Font Size 확장 생성
const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "22px", "24px", "26px", "28px", "30px", "32px"];

// 색상 팔레트 - test1.html 참조
const COLORS = [
  // 그레이 스케일
  "#181D27",
  "#252B37",
  "#414651",
  "#535862",
  "#717680",
  "#A4A7AE",
  "#D5D7DA",
  "#FFFFFF",
  // 컬러 팔레트
  "#079455",
  "#1570EF",
  "#444CE7",
  "#6938EF",
  "#BA24D5",
  "#DD2590",
  "#D92D20",
  "#E04F16",
];

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

  const currentMemo = currentMemoId && currentMemoId !== "NEW_FILE" ? memos.find((m) => m.id === currentMemoId) : null;

  // Tiptap 에디터 초기화
  const editor = useEditor({
    extensions: [
      StarterKit,
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
      handleContentChange(html);
    },
  });

  // 에디터 내용 업데이트
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
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

    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks) {
        const textStyleMark = node.marks.find((mark) => mark.type.name === "textStyle");
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
      fontFamily: fontFamilies.size === 1 ? Array.from(fontFamilies)[0] : "",
      fontSize: fontSizes.size === 1 ? Array.from(fontSizes)[0] : "",
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
      title: title || undefined,
      year: year || undefined,
      grade: grade || undefined,
      subject: subject || undefined,
      student: student || undefined,
    };

    // Only save if we have some data to preserve
    if (Object.values(currentAttributes).some(val => val !== undefined && val !== "")) {
      setPreservedAttributes(currentAttributes);
    }
  }, [user?.mode, title, year, grade, subject, student, setPreservedAttributes]);

  // Restore preserved attributes when starting new file or mode changes
  useEffect(() => {
    // 새 파일이거나 현재 메모가 없을 때 보존된 속성 복원
    if ((isNewFile || !currentMemo) && user?.mode && preservedAttributes) {
      // Restore attributes based on current mode
      if (user.mode === "일반" && preservedAttributes.title && !title) {
        setTitle(preservedAttributes.title);
      }
      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.grade && !grade) {
        setGrade(preservedAttributes.grade as Grade);
      }
      if ((user.mode === "학생" || user.mode === "교사") && preservedAttributes.subject && !subject) {
        setSubject(preservedAttributes.subject);
      }
      if (user.mode === "교사" && preservedAttributes.year && !year) {
        setYear(preservedAttributes.year as Year);
      }
      if (user.mode === "교사" && preservedAttributes.student && !student) {
        setStudent(preservedAttributes.student);
      }
    }
  }, [isNewFile, currentMemo, user?.mode, preservedAttributes, title, grade, subject, year, student]);

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

  const handleContentChange = (value: string) => {
    setContent(value);
    if (isNewFile && value.trim() !== "") {
      setIsDraft(true); // 새 파일에서 내용을 입력하기 시작하면 draft 상태로 변경
    } else if (!isNewFile) {
      setIsDraft(true);
    }

    if (!user?.isLoggedIn) {
      setLocalMemo(value);
    }
  };

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

  const getWordCount = (text: string) => {
    // HTML 태그 제거 후 단어 수 계산
    const plainText = text.replace(/<[^>]*>/g, "");
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

    // HTML 태그 제거
    const plainText = content.replace(/<[^>]*>/g, "");

    // 개행 문자 처리
    let processedContent = plainText;
    if (processedContent === "\n" && processedContent.startsWith("\n")) {
      processedContent = processedContent.slice(1);
    }
    if (processedContent !== "\n" && processedContent.endsWith("\n")) {
      processedContent = processedContent.slice(0, -1);
    }

    // 수학 기호와 그리스 문자를 정의
    const math_symbols = /[+\-*/=<>∞∑∏∫√∂∆πθΩαβγδεζηλμνξοπρστυφχψω·]/g;
    const other_symbols = /[''""]/g;

    // 각 카테고리별 필터링
    const english = processedContent
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(/\s/g, "") // 공백 제거
      .replace(other_symbols, ""); // 기타 기호 제거

    const korean = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(/\s/g, "") // 공백 제거
      .replace(other_symbols, ""); // 기타 기호 제거

    const number = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(/\s/g, "") // 공백 제거
      .replace(other_symbols, ""); // 기타 기호 제거

    const onebyte_special = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(/[\n\t\r\s]/g, ""); // 공백 및 줄바꿈 제거

    const threebyte_special = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(/[\n\t\r\s]/g, "") // 공백 및 줄바꿈 제거
      .replace(other_symbols, ""); // 기타 기호 제거

    const space = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(other_symbols, "") // 기타 기호 제거
      .replace(/[^\s]/g, "") // 공백 이외의 문자 제거
      .replace(/[\n\r]/g, ""); // 줄바꿈 문자 제거

    const line = processedContent
      .replace(/[a-zA-Z]/g, "") // 영문 제거
      .replace(/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g, "") // 한글 제거
      .replace(/[{}[\]/?.,;:|)*~`!^\-_+<>@#$%&\\=()'"]/g, "") // 특수문자 제거
      .replace(/[0-9]/g, "") // 숫자 제거
      .replace(math_symbols, "") // 수학 기호 제거
      .replace(/[^\n]/g, "") // 줄바꿈 이외 문자 제거
      .replace(other_symbols, ""); // 기타 기호 제거

    // 최종 계산
    return (
      english.length +
      korean.length * 3 +
      number.length +
      onebyte_special.length +
      threebyte_special.length * 3 +
      space.length +
      line.length * 2
    );
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
            <div className="mb-4 flex flex-col gap-3 w-full">
              {/* Top Row - Font Controls */}
              <div className="flex w-max flex-col items-start justify-center gap-2 md:flex-row md:items-center md:justify-start md:gap-3">
                <div className="flex gap-2 items-center">
                  {/* Undo/Redo */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().undo()}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <Undo className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().redo()}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <Redo className="w-4 h-4" />
                  </Button>

                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Font Family */}
                  <div className="flex flex-col gap-1.5 w-full md:w-42">
                    <Select
                      key={`font-family-${updateTrigger}`}
                      value={getCurrentFontProperties().fontFamily}
                      open={fontFamilyOpen}
                      onOpenChange={setFontFamilyOpen}
                      onValueChange={(value) => {
                        if (!editor) return;

                        editor.chain().focus();

                        if (value === "system-ui") {
                          // 기본 폰트로 설정 (폰트 패밀리 제거)
                          editor.chain().unsetFontFamily().run();
                        } else {
                          // 특정 폰트로 설정
                          editor.chain().setFontFamily(value).run();
                        }

                        // 즉시 UI 업데이트
                        setTimeout(triggerUpdate, 0);
                        setFontFamilyOpen(false);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm border-border hover:border-border/80 focus:border-ring">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-muted-foreground"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M4 7c0-.932 0-1.398.152-1.765a2 2 0 0 1 1.083-1.083C5.602 4 6.068 4 7 4h10c.932 0 1.398 0 1.765.152a2 2 0 0 1 1.083 1.083C20 5.602 20 6.068 20 7M9 20h6M12 4v16" />
                          </svg>
                          <SelectValue placeholder="폰트 선택" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system-ui">기본</SelectItem>
                        <SelectItem value="Pretendard">Pretendard</SelectItem>
                        <SelectItem value="'NanumSquare Neo'">나눔스퀘어 네오</SelectItem>
                        <SelectItem value="MaruBuri">마루 부리</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font Size */}
                  <div className="flex flex-col gap-1.5 w-full md:w-22">
                    <Select
                      key={`font-size-${updateTrigger}`}
                      value={getCurrentFontProperties().fontSize}
                      open={fontSizeOpen}
                      onOpenChange={setFontSizeOpen}
                      onValueChange={(value) => {
                        if (!editor) return;

                        editor.chain().focus();

                        if (value === "default") {
                          // 기본 크기로 설정 (폰트 사이즈 제거)
                          editor.chain().unsetFontSize().run();
                        } else {
                          // 특정 크기로 설정
                          editor.chain().setFontSize(value).run();
                        }

                        // 즉시 UI 업데이트
                        setTimeout(triggerUpdate, 0);
                        setFontSizeOpen(false);
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm border-border hover:border-border/80 focus:border-ring">
                        <SelectValue placeholder="크기 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_SIZES.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Bottom Row - Format Controls */}
                <div className="flex flex-wrap gap-0.5 md:flex-nowrap items-center">
                  {/* Text Formatting */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive("bold") ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <Bold className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive("italic") ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <Italic className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive("strike") ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <Strikethrough className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive("underline") ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <UnderlineIcon className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().toggleHighlight().run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive("highlight") ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <Highlighter className="w-5 h-5" />
                  </Button>

                  {/* Separator */}
                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Color Picker */}
                  <div className="relative" ref={colorPaletteRef}>
                    <button
                      type="button"
                      onClick={() => setShowColorPalette(!showColorPalette)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted"
                    >
                      <div
                        className="size-4 rounded-full border border-border bg-foreground"
                        style={{ 
                          backgroundColor: editor?.getAttributes("textStyle").color || undefined
                        }}
                      />
                    </button>

                    {showColorPalette && (
                      <div className="absolute top-full left-0 mt-1 z-50 rounded-xl bg-background border border-border p-3 shadow-lg w-52 min-w-52">
                        <div className="grid grid-cols-8 gap-1">
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                editor?.chain().focus().setColor(color).run();
                                setShowColorPalette(false);
                              }}
                              className="p-0.5 hover:bg-muted rounded"
                            >
                              <div
                                className={`size-4 cursor-pointer rounded-full ring-1 ring-black/10 ring-inset ${
                                  editor?.getAttributes("textStyle").color === color ? "outline-2 outline-offset-2" : ""
                                }`}
                                style={{
                                  backgroundColor: color,
                                  outlineColor: color,
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Separator */}
                  <div className="w-px h-6 bg-border mx-1" />

                  {/* Text Alignment */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive({ textAlign: "left" }) ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <AlignLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive({ textAlign: "center" }) ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <AlignCenter className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive({ textAlign: "right" }) ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <AlignRight className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
                    className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                      editor?.isActive({ textAlign: "justify" }) ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <AlignJustify className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 min-h-[600px]">
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[560px] [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t bg-card p-4">
          <div className="text-right text-accented-foreground space-y-1">
            <div className="text-2xl font-bold tabular-nums">{byteCount.toLocaleString()} 바이트</div>
            <div className="text-md tabular-nums">단어 {wordCount.words.toLocaleString()} 개</div>
            <div className="text-md tabular-nums">공백 포함 {wordCount.charactersWithSpaces.toLocaleString()} 자</div>
            <div className="text-md tabular-nums">공백 제외 {wordCount.charactersWithoutSpaces.toLocaleString()} 자</div>
          </div>
        </div>
      </div>
    );
  }

  // Main editor view
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with save button and auto-save status */}
      <div className="border-b bg-card px-6 py-3">
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

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header fields based on mode */}
          {user.mode === "일반" && (
            <div className="mb-6">
              <Input
                value={title}
                onChange={(e) => handleFieldChange("title", e.target.value)}
                placeholder="제목 없음"
                className="text-lg font-medium"
              />
            </div>
          )}

          {user.mode === "학생" && (
            <div className="mb-6 flex justify-start">
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
            <div className="mb-6 flex justify-start">
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
          <div className="mb-4 flex flex-col gap-3 w-full">
            {/* Top Row - Font Controls */}
            <div className="flex w-max flex-col items-start justify-center gap-2 md:flex-row md:items-center md:justify-start md:gap-3">
              <div className="flex gap-2 items-center">
                {/* Undo/Redo */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().undo().run()}
                  disabled={!editor?.can().undo()}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().redo().run()}
                  disabled={!editor?.can().redo()}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <Redo className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                {/* Font Family */}
                <div className="flex flex-col gap-1.5 w-full md:w-42">
                  <Select
                    key={`font-family-${updateTrigger}`}
                    value={getCurrentFontProperties().fontFamily}
                    open={fontFamilyOpen}
                    onOpenChange={setFontFamilyOpen}
                    onValueChange={(value) => {
                      if (!editor) return;

                      editor.chain().focus();

                      if (value === "system-ui") {
                        // 기본 폰트로 설정 (폰트 패밀리 제거)
                        editor.chain().unsetFontFamily().run();
                      } else {
                        // 특정 폰트로 설정
                        editor.chain().setFontFamily(value).run();
                      }

                      // 즉시 UI 업데이트
                      setTimeout(triggerUpdate, 0);
                      setFontFamilyOpen(false);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm border-border hover:border-border/80 focus:border-ring">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M4 7c0-.932 0-1.398.152-1.765a2 2 0 0 1 1.083-1.083C5.602 4 6.068 4 7 4h10c.932 0 1.398 0 1.765.152a2 2 0 0 1 1.083 1.083C20 5.602 20 6.068 20 7M9 20h6M12 4v16" />
                        </svg>
                        <SelectValue placeholder="폰트 선택" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system-ui">기본</SelectItem>
                      <SelectItem value="Pretendard">Pretendard</SelectItem>
                      <SelectItem value="'NanumSquare Neo'">나눔스퀘어 네오</SelectItem>
                      <SelectItem value="MaruBuri">마루 부리</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size */}
                <div className="flex flex-col gap-1.5 w-full md:w-22">
                  <Select
                    key={`font-size-${updateTrigger}`}
                    value={getCurrentFontProperties().fontSize}
                    open={fontSizeOpen}
                    onOpenChange={setFontSizeOpen}
                    onValueChange={(value) => {
                      if (!editor) return;

                      editor.chain().focus();

                      if (value === "default") {
                        // 기본 크기로 설정 (폰트 사이즈 제거)
                        editor.chain().unsetFontSize().run();
                      } else {
                        // 특정 크기로 설정
                        editor.chain().setFontSize(value).run();
                      }

                      // 즉시 UI 업데이트
                      setTimeout(triggerUpdate, 0);
                      setFontSizeOpen(false);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm border-border hover:border-border/80 focus:border-ring">
                      <SelectValue placeholder="크기 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bottom Row - Format Controls */}
              <div className="flex flex-wrap gap-0.5 md:flex-nowrap items-center">
                {/* Text Formatting */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive("bold") ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Bold className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive("italic") ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Italic className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive("strike") ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Strikethrough className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive("underline") ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <UnderlineIcon className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleHighlight().run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive("highlight") ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <Highlighter className="w-5 h-5" />
                </Button>

                {/* Separator */}
                <div className="w-px h-6 bg-border mx-1" />

                {/* Color Picker */}
                <div className="relative" ref={colorPaletteRef}>
                  <button
                    type="button"
                    onClick={() => setShowColorPalette(!showColorPalette)}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted"
                  >
                    <div
                      className="size-4 rounded-full border border-border bg-foreground"
                      style={{ 
                        backgroundColor: editor?.getAttributes("textStyle").color || undefined
                      }}
                    />
                  </button>

                  {showColorPalette && (
                    <div className="absolute top-full left-0 mt-1 z-50 rounded-xl bg-background border border-border p-3 shadow-lg w-52 min-w-52">
                      <div className="grid grid-cols-8 gap-1">
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              editor?.chain().focus().setColor(color).run();
                              setShowColorPalette(false);
                            }}
                            className="p-0.5 hover:bg-muted rounded"
                          >
                            <div
                              className={`size-4 cursor-pointer rounded-full ring-1 ring-black/10 ring-inset ${
                                editor?.getAttributes("textStyle").color === color ? "outline-2 outline-offset-2" : ""
                              }`}
                              style={{
                                backgroundColor: color,
                                outlineColor: color,
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-border mx-1" />

                {/* Text Alignment */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive({ textAlign: "left" }) ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <AlignLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive({ textAlign: "center" }) ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <AlignCenter className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive({ textAlign: "right" }) ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <AlignRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted ${
                    editor?.isActive({ textAlign: "justify" }) ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <AlignJustify className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tiptap Editor */}
          <div className="border rounded-lg p-4 min-h-[600px]">
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:min-h-[560px] [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t bg-card p-4">
        <div className="text-right text-accented-foreground space-y-1">
          <div className="text-2xl font-bold tabular-nums">{byteCount.toLocaleString()} 바이트</div>
          <div className="text-md tabular-nums">단어 {wordCount.words.toLocaleString()} 개</div>
          <div className="text-md tabular-nums">공백 포함 {wordCount.charactersWithSpaces.toLocaleString()} 자</div>
          <div className="text-md tabular-nums">공백 제외 {wordCount.charactersWithoutSpaces.toLocaleString()} 자</div>
        </div>
      </div>
    </div>
  );
}
