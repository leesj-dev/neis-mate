import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import type { Folder } from "@/types";

interface FolderContextMenuProps {
  folder: Folder;
  onRename: (folderId: string, currentName: string) => void;
  onDelete: (folderId: string) => void;
}

export function FolderContextMenu({ folder, onRename, onDelete }: FolderContextMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleRename = () => {
    onRename(folder.id, folder.name);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (confirm("정말로 이 폴더를 삭제하시겠습니까?")) {
      onDelete(folder.id);
      setShowMenu(false);
    }
  };

  if (showMenu) {
    return (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
        <div className="absolute right-0 top-0 z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]">
          <button
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
            onClick={handleRename}
          >
            <Edit className="h-4 w-4" />
            이름 변경
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
