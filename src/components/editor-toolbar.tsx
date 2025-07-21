import { useRef } from "react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
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
import type { Editor } from "@tiptap/react";

// Export extensions for use in editor.tsx
export { StarterKit, TextAlign, Highlight, TextStyle, FontFamily, Color };

// Font Size 확장 생성
export const FontSize = Extension.create({
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

interface EditorToolbarProps {
  editor: Editor | null;
  updateTrigger: number;
  triggerUpdate: () => void;
  fontFamilyOpen: boolean;
  setFontFamilyOpen: (open: boolean) => void;
  fontSizeOpen: boolean;
  setFontSizeOpen: (open: boolean) => void;
  showColorPalette: boolean;
  setShowColorPalette: (show: boolean) => void;
  getCurrentFontProperties: () => { fontFamily: string; fontSize: string };
}

export function EditorToolbar({
  editor,
  updateTrigger,
  triggerUpdate,
  fontFamilyOpen,
  setFontFamilyOpen,
  fontSizeOpen,
  setFontSizeOpen,
  showColorPalette,
  setShowColorPalette,
  getCurrentFontProperties,
}: EditorToolbarProps) {
  const colorPaletteRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mb-4 flex flex-col gap-3 w-full">
      {/* Top Row - Font Controls */}
      <div className="flex w-max flex-col items-start justify-center gap-2 md:flex-row md:items-center md:justify-start md:gap-3">
        <div className="flex gap-2 items-center">
          {/* Undo/Redo with smaller gap */}
          <div className="flex gap-1 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              className="flex w-10 h-10 cursor-pointer items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50 flex-shrink-0"
            >
              <Undo className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              className="flex w-10 h-10 cursor-pointer items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50 flex-shrink-0"
            >
              <Redo className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Font Family */}
          <div className="flex flex-col gap-1.5 w-full md:w-42">
            <Select
              key={`font-family-${updateTrigger}`}
              value={
                getCurrentFontProperties().fontFamily === "mixed" ? "" : getCurrentFontProperties().fontFamily
              }
              open={fontFamilyOpen}
              onOpenChange={setFontFamilyOpen}
              onValueChange={(value) => {
                if (!editor) return;

                editor.chain().focus();

                // 현재 폰트 사이즈 보존
                const currentFontSize = getCurrentFontProperties().fontSize;
                const preserveSize =
                  currentFontSize && currentFontSize !== "16px" && currentFontSize !== "mixed";

                if (value === "system-ui") {
                  // 기본 폰트로 설정하되, 현재 폰트 사이즈는 유지
                  if (preserveSize) {
                    editor.chain().setMark("textStyle", { fontFamily: null, fontSize: currentFontSize }).run();
                  } else {
                    editor.chain().unsetFontFamily().run();
                  }
                } else {
                  // 특정 폰트로 설정하되, 현재 폰트 사이즈는 유지
                  if (preserveSize) {
                    editor.chain().setMark("textStyle", { fontFamily: value, fontSize: currentFontSize }).run();
                  } else {
                    editor.chain().setFontFamily(value).run();
                  }
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

          {/* Font Size - Mobile: with color picker, Desktop: separate */}
          <div className="flex flex-col gap-1.5 w-full md:w-22 md:block">
            {/* Desktop: Font Size Only */}
            <div className="hidden md:block">
              <Select
                key={`font-size-${updateTrigger}`}
                value={
                  getCurrentFontProperties().fontSize === "mixed" ? "" : getCurrentFontProperties().fontSize
                }
                open={fontSizeOpen}
                onOpenChange={setFontSizeOpen}
                onValueChange={(value) => {
                  if (!editor) return;

                  editor.chain().focus();

                  // 현재 폰트 패밀리 보존
                  const currentFontFamily = getCurrentFontProperties().fontFamily;
                  const preserveFamily =
                    currentFontFamily && currentFontFamily !== "system-ui" && currentFontFamily !== "mixed";

                  if (value === "default") {
                    // 기본 크기로 설정하되, 현재 폰트 패밀리는 유지
                    if (preserveFamily) {
                      editor
                        .chain()
                        .setMark("textStyle", { fontFamily: currentFontFamily, fontSize: null })
                        .run();
                    } else {
                      editor.chain().unsetFontSize().run();
                    }
                  } else {
                    // 특정 크기로 설정하되, 현재 폰트 패밀리는 유지
                    if (preserveFamily) {
                      editor
                        .chain()
                        .setMark("textStyle", { fontFamily: currentFontFamily, fontSize: value })
                        .run();
                    } else {
                      editor.chain().setFontSize(value).run();
                    }
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

            {/* Mobile: Font Size + Color Picker */}
            <div className="flex gap-2 items-center md:hidden">
              <div className="flex-1">
                <Select
                  key={`font-size-mobile-${updateTrigger}`}
                  value={
                    getCurrentFontProperties().fontSize === "mixed" ? "" : getCurrentFontProperties().fontSize
                  }
                  open={fontSizeOpen}
                  onOpenChange={setFontSizeOpen}
                  onValueChange={(value) => {
                    if (!editor) return;

                    editor.chain().focus();

                    // 현재 폰트 패밀리 보존
                    const currentFontFamily = getCurrentFontProperties().fontFamily;
                    const preserveFamily =
                      currentFontFamily && currentFontFamily !== "system-ui" && currentFontFamily !== "mixed";

                    if (value === "default") {
                      // 기본 크기로 설정하되, 현재 폰트 패밀리는 유지
                      if (preserveFamily) {
                        editor
                          .chain()
                          .setMark("textStyle", { fontFamily: currentFontFamily, fontSize: null })
                          .run();
                      } else {
                        editor.chain().unsetFontSize().run();
                      }
                    } else {
                      // 특정 크기로 설정하되, 현재 폰트 패밀리는 유지
                      if (preserveFamily) {
                        editor
                          .chain()
                          .setMark("textStyle", { fontFamily: currentFontFamily, fontSize: value })
                          .run();
                      } else {
                        editor.chain().setFontSize(value).run();
                      }
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

              {/* Separator - Mobile Only */}
              <div className="w-px h-6 bg-border ml-1 -mr-0.5 md:hidden" />
              
              {/* Color Picker - Mobile Only */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowColorPalette(!showColorPalette)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted"
                >
                  <div
                    className="size-4 rounded-full border border-border bg-foreground"
                    style={{
                      backgroundColor: editor?.getAttributes("textStyle").color || undefined,
                    }}
                  />
                </button>

                {showColorPalette && (
                  <div className="absolute top-full right-0 mt-1 z-50 rounded-xl bg-background border border-border p-3 shadow-lg w-52 min-w-52">
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
                              editor?.getAttributes("textStyle").color === color
                                ? "outline-2 outline-offset-2"
                                : ""
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
            </div>
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

          {/* Color Picker - Desktop Only */}
          <div className="relative hidden md:block" ref={colorPaletteRef}>
            <button
              type="button"
              onClick={() => setShowColorPalette(!showColorPalette)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted"
            >
              <div
                className="size-4 rounded-full border border-border bg-foreground"
                style={{
                  backgroundColor: editor?.getAttributes("textStyle").color || undefined,
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

          {/* Separator - Desktop Only */}
          <div className="w-px h-6 bg-border mx-1 hidden md:block" />

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
  );
}
