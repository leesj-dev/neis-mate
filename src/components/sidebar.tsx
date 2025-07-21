import { useState, useMemo } from "react";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { MemoContextMenu } from "@/components/memo-context-menu";
import { FolderContextMenu } from "@/components/folder-context-menu";
import { Tree } from "primereact/tree";
import {
  FolderPlus,
  FilePlus,
  Search,
  Menu,
  ArrowUpDown,
} from "lucide-react";
import type { Memo, Folder, SortOption, GeneralMemo } from "@/types";
import { generateFolderId } from "@/lib/memo-utils";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

// TreeNode type definition
interface TreeNode {
  key: string;
  label: string;
  type: "folder" | "memo";
  data?: Memo | Folder;
  children?: TreeNode[];
  icon: string;
}

// Custom CSS to override PrimeReact Tree styles
const treeStyles = `
  .p-tree {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    height: 100% !important;
    color: hsl(var(--foreground)) !important;
  }
  
  .p-tree .p-tree-container {
    padding: 0 !important;
    height: 100% !important;
  }

  .p-tree .p-treenode-content {
    padding: 2px 4px !important;
    border-radius: 4px !important;
    transition: background-color 0.2s !important;
    color: hsl(var(--foreground)) !important;
  }
  
  .p-tree .p-treenode-content:hover {
    background-color: hsl(var(--muted)) !important;
  }
  
  .p-tree .p-treenode-content.p-highlight {
    background-color: hsl(var(--accent)) !important;
    color: inherit !important;
  }
  
  .p-tree .p-treenode-content.p-highlight .p-treenode-label {
    color: inherit !important;
  }
  
  .p-tree .p-treenode-content.p-highlight * {
    color: inherit !important;
  }

  .p-tree .p-treenode-label {
    color: hsl(var(--foreground)) !important;
  }

  .p-tree .p-treenode-icon {
    color: hsl(var(--muted-foreground)) !important;
  }

  .p-tree .p-tree-toggler {
    width: 14px !important;
    height: 14px !important;
    margin-left: 8px !important;
    margin-right: 12px !important;
    color: hsl(var(--muted-foreground)) !important;
  }

  .p-tree .p-tree-toggler:hover {
    background-color: hsl(var(--muted)) !important;
    border-radius: 4px !important;
  }

  .p-treenode {
    padding: 1px !important;
    min-height: 34px !important;
  } 
  
  .p-tree .p-tree-toggler {
    width: 14px !important;
    height: 14px !important;
    margin-left: 8px !important;
    margin-right: 12px !important;
  }
  
  .p-tree .p-treenode-icon {
    margin-right: 8px !important;
  }
  
  .p-tree .p-treenode-label {
    margin-left: 4px !important;
  }
  
  .p-treenode-droppoint {
    height: 4px !important;
  }

  .p-tree-container {
    height: 100% !important;
    min-height: 0 !important;
  }
  
`;

export function Sidebar() {
  const {
    user,
    memos,
    folders,
    setCurrentMemoId,
    setCurrentFolderId,
    sidebarCollapsed,
    setSidebarCollapsed,
    sortOption,
    setSortOption,
    addFolder,
    setFolders,
    updateMemo,
    deleteFolder,
    setLoginModalDismissed,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [selectedKeys, setSelectedKeys] = useState<string>("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>("");
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoTitle, setEditingMemoTitle] = useState<string>("");
  const [lastSelectedKey, setLastSelectedKey] = useState<string>("");

  const canCreateFolders = user?.mode === "일반";

  const handleCreateNewMemo = () => {
    if (!user?.isLoggedIn) {
      // 로그인하지 않은 상태에서는 로그인 모달 표시
      setLoginModalDismissed(false);
      return;
    }
    
    if (!user || !user.mode) return;
    
    setCurrentMemoId(null);
    setTimeout(() => setCurrentMemoId("NEW_FILE"), 0);
  };

  const handleCreateNewFolder = () => {
    if (!user || user.mode !== "일반") return;
    
    const newFolder: Folder = {
      id: generateFolderId(),
      name: "새 폴더",
      createdAt: new Date(),
      parentId: undefined,
    };
    
    addFolder(newFolder);
    setEditingFolderId(newFolder.id);
    setEditingFolderName(newFolder.name);
    console.log("새 폴더 생성됨:", newFolder);
  };

  const getMemoTitle = (memo: Memo): string => {
    switch (memo.mode) {
      case "일반":
        return memo.title || "제목 없음";
      case "학생":
      case "교사":
        return memo.displayTitle || "제목 없음";
      default:
        return "제목 없음";
    }
  };

  // Filter memos
  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      if (!searchQuery) return true;
      const searchLower = searchQuery.toLowerCase();
      const title = getMemoTitle(memo);
      return title.toLowerCase().includes(searchLower);
    });
  }, [memos, searchQuery]);

  // Sort memos
  const sortedMemos = useMemo(() => {
    return [...filteredMemos].sort((a, b) => {
      switch (sortOption) {
        case "alphabetical": {
          const aTitle = getMemoTitle(a);
          const bTitle = getMemoTitle(b);
          return aTitle.localeCompare(bTitle, "ko");
        }
        case "recently-created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "recently-viewed":
          return new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
        case "recently-modified":
        default:
          return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      }
    });
  }, [filteredMemos, sortOption]);

  // Build tree data for PrimeReact Tree
  const buildTreeData = useMemo(() => {
    if (user?.mode === "일반") {
      // Build folder tree for general mode
      const folderMap = new Map<string, TreeNode>();
      
      // Create folder nodes
      folders.forEach(folder => {
        const node: TreeNode = {
          key: `folder-${folder.id}`,
          label: folder.name,
          type: "folder",
          data: folder,
          children: [],
          icon: "pi pi-folder",
        };
        folderMap.set(folder.id, node);
      });

      // Build hierarchy
      const rootNodes: TreeNode[] = [];
      folders.forEach(folder => {
        const node = folderMap.get(folder.id)!;
        if (folder.parentId && folderMap.has(folder.parentId)) {
          const parent = folderMap.get(folder.parentId)!;
          parent.children!.push(node);
        } else {
          rootNodes.push(node);
        }
      });

      // Add memos to appropriate folders (using sortedMemos which includes filtering)
      sortedMemos.forEach(memo => {
        if (memo.mode === "일반") {
          const generalMemo = memo as GeneralMemo;
          const memoNode: TreeNode = {
            key: `memo-${memo.id}`,
            label: getMemoTitle(memo),
            type: "memo",
            data: memo,
            icon: "pi pi-file",
          };

          if (generalMemo.folderId && folderMap.has(generalMemo.folderId)) {
            folderMap.get(generalMemo.folderId)!.children!.push(memoNode);
          } else {
            rootNodes.push(memoNode);
          }
        }
      });

      // If search is active, filter out empty folders
      if (searchQuery.trim()) {
        const hasContent = (node: TreeNode): boolean => {
          if (node.type === "memo") return true;
          if (node.children && node.children.length > 0) {
            node.children = node.children.filter(hasContent);
            return node.children.length > 0;
          }
          return false;
        };

        return rootNodes.filter(hasContent);
      }

      return rootNodes;
    } else if (user?.mode === "학생") {
      // Build virtual folder tree for student mode
      const gradeGroups = new Map<string, Memo[]>();
      sortedMemos.forEach(memo => {
        if (memo.mode === "학생") {
          if (!gradeGroups.has(memo.grade)) {
            gradeGroups.set(memo.grade, []);
          }
          gradeGroups.get(memo.grade)?.push(memo);
        }
      });

      // Filter out empty grade groups when searching
      const filteredGroups = Array.from(gradeGroups.entries()).filter(([, memos]) => memos.length > 0);

      return filteredGroups.map(([grade, memos]) => ({
        key: `grade-${grade}`,
        label: grade,
        type: "folder" as const,
        icon: "pi pi-folder",
        children: memos.map(memo => ({
          key: `memo-${memo.id}`,
          label: getMemoTitle(memo),
          type: "memo" as const,
          data: memo,
          icon: "pi pi-file",
        })),
      }));
    } else if (user?.mode === "교사") {
      // Build virtual folder tree for teacher mode
      const yearGroups = new Map<number, Map<string, Map<string, Memo[]>>>();
      sortedMemos.forEach(memo => {
        if (memo.mode === "교사") {
          if (!yearGroups.has(memo.year)) {
            yearGroups.set(memo.year, new Map());
          }
          const gradeMap = yearGroups.get(memo.year)!;
          if (!gradeMap.has(memo.grade)) {
            gradeMap.set(memo.grade, new Map());
          }
          const subjectMap = gradeMap.get(memo.grade)!;
          if (!subjectMap.has(memo.subject)) {
            subjectMap.set(memo.subject, []);
          }
          subjectMap.get(memo.subject)?.push(memo);
        }
      });

      const result: TreeNode[] = [];
      yearGroups.forEach((gradeMap, year) => {
        const yearNode: TreeNode = {
          key: `year-${year}`,
          label: year.toString(),
          type: "folder",
          icon: "pi pi-folder",
          children: [] as TreeNode[],
        };

        gradeMap.forEach((subjectMap, grade) => {
          const gradeNode: TreeNode = {
            key: `grade-${year}-${grade}`,
            label: grade,
            type: "folder",
            icon: "pi pi-folder",
            children: [] as TreeNode[],
          };

          subjectMap.forEach((memos, subject) => {
            if (memos.length > 0) {
              const subjectNode: TreeNode = {
                key: `subject-${year}-${grade}-${subject}`,
                label: subject,
                type: "folder",
                icon: "pi pi-folder",
                children: memos.map(memo => ({
                  key: `memo-${memo.id}`,
                  label: getMemoTitle(memo),
                  type: "memo" as const,
                  data: memo,
                  icon: "pi pi-file",
                })),
              };
              gradeNode.children!.push(subjectNode);
            }
          });

          if (gradeNode.children!.length > 0) {
            yearNode.children!.push(gradeNode);
          }
        });

        if (yearNode.children!.length > 0) {
          result.push(yearNode);
        }
      });

      return result;
    }

    // 로그인하지 않은 상태에서는 빈 배열 반환
    return [];
  }, [user, folders, sortedMemos, searchQuery]);

  if (sidebarCollapsed) {
    return (
      <div className="w-14 border-r bg-card p-2">
        <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)}>
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // 로그인하지 않은 상태에서는 사이드바 숨김
  if (!user?.isLoggedIn) {
    return null;
  }

  const handleStartEditingFolder = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleSaveFolderName = (folderId: string) => {
    if (!editingFolderName.trim()) return;
    
    const updatedFolders = folders.map(f => 
      f.id === folderId ? { ...f, name: editingFolderName.trim() } : f
    );
    setFolders(updatedFolders);
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleCancelEditingFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleStartEditingMemo = (memoId: string, currentTitle: string) => {
    setEditingMemoId(memoId);
    setEditingMemoTitle(currentTitle);
  };

  const handleSaveMemoTitle = (memoId: string) => {
    if (!editingMemoTitle.trim()) return;
    
    if (user?.mode === "일반") {
      updateMemo(memoId, { title: editingMemoTitle.trim() });
    } else {
      updateMemo(memoId, { displayTitle: editingMemoTitle.trim() });
    }
    setEditingMemoId(null);
    setEditingMemoTitle("");
  };

  const handleCancelEditingMemo = () => {
    setEditingMemoId(null);
    setEditingMemoTitle("");
  };


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onNodeSelect = (event: any) => {
    const node = event.node as TreeNode;
    const nodeKey = node.key;
    
    if (node.type === "memo") {
      setCurrentMemoId((node.data as Memo).id);
      setLastSelectedKey(nodeKey);
    } else if (node.type === "folder") {
      if (user?.mode === "일반") {
        setCurrentFolderId((node.data as Folder).id);
      }
      
      // Check if this is a second click on the same folder
      if (lastSelectedKey === nodeKey) {
        // Toggle expand/collapse
        setExpandedKeys(prev => ({
          ...prev,
          [nodeKey]: !prev[nodeKey]
        }));
      }
      setLastSelectedKey(nodeKey);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onDragDrop = (event: any) => {
    const { dragNode, dropNode } = event;
    const dragTreeNode = dragNode as TreeNode;
    const dropTreeNode = dropNode as TreeNode | null;
    
    if (user?.mode !== "일반") return;

    if (dragTreeNode.type === "memo") {
      const memoId = (dragTreeNode.data as Memo).id;
      const targetFolderId = dropTreeNode?.type === "folder" ? (dropTreeNode.data as Folder).id : null;
      updateMemo(memoId, { folderId: targetFolderId || undefined });
      console.log(`메모 ${memoId}를 폴더 ${targetFolderId || "root"}로 이동`);
    } else if (dragTreeNode.type === "folder") {
      const folderId = (dragTreeNode.data as Folder).id;
      const targetFolderId = dropTreeNode?.type === "folder" ? (dropTreeNode.data as Folder).id : null;
      
      if (folderId !== targetFolderId) {
        const updatedFolders = folders.map(f => 
          f.id === folderId ? { ...f, parentId: targetFolderId || undefined } : f
        );
        setFolders(updatedFolders);
        console.log(`폴더 ${folderId}를 폴더 ${targetFolderId || "root"}로 이동`);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeTemplate = (node: any) => {
    const treeNode = node as TreeNode;
    const isEditingFolder = editingFolderId === (treeNode.data as Folder)?.id;
    const isEditingMemo = editingMemoId === (treeNode.data as Memo)?.id;
    
    return (
      <div className="flex items-center justify-between w-full group py-1">
        <div className="flex items-center gap-2 flex-1">
          {isEditingFolder ? (
            <input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onBlur={() => handleSaveFolderName((treeNode.data as Folder).id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveFolderName((treeNode.data as Folder).id);
                } else if (e.key === "Escape") {
                  handleCancelEditingFolder();
                }
              }}
              className="text-sm bg-background border border-input px-2 py-1 rounded flex-1"
              autoFocus
            />
          ) : isEditingMemo ? (
            <input
              type="text"
              value={editingMemoTitle}
              onChange={(e) => setEditingMemoTitle(e.target.value)}
              onBlur={() => handleSaveMemoTitle((treeNode.data as Memo).id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveMemoTitle((treeNode.data as Memo).id);
                } else if (e.key === "Escape") {
                  handleCancelEditingMemo();
                }
              }}
              className="text-sm bg-background border border-input px-2 py-1 rounded flex-1"
              autoFocus
            />
          ) : (
            <span className="text-sm text-foreground">{treeNode.label}</span>
          )}
        </div>
        
        {!isEditingFolder && !isEditingMemo && (
          <div className="flex items-center gap-1 min-h-[25px]">
            {treeNode.type === "memo" && treeNode.data && (
              <div className="opacity-0 group-hover:opacity-100 relative transition-opacity duration-200 ease-in-out">
                <MemoContextMenu 
                  memo={treeNode.data as Memo} 
                  onRename={user?.mode === "일반" ? handleStartEditingMemo : undefined}
                />
              </div>
            )}
            {treeNode.type === "folder" && user?.mode === "일반" && treeNode.data && (
              <div className="opacity-0 group-hover:opacity-100 relative transition-opacity duration-200 ease-in-out">
                <FolderContextMenu 
                  folder={treeNode.data as Folder}
                  onRename={handleStartEditingFolder}
                  onDelete={deleteFolder}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full">
      <style>{treeStyles}</style>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold pl-0.5">보관함</h2>
          <Button variant="ghost" size="icon" className="w-5 h-6" onClick={() => setSidebarCollapsed(true)}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="파일 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCreateNewMemo} className="flex-1">
            <FilePlus className="h-4 w-4 mr-2" />새 파일
          </Button>
          {canCreateFolders && (
            <Button variant="outline" size="sm" onClick={handleCreateNewFolder} className="flex-1">
              <FolderPlus className="h-4 w-4 mr-2" />새 폴더
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-end items-center px-2 py-1">
          <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
            <SelectTrigger className="w-10 h-8 px-1 border-0 bg-transparent hover:bg-accent">
              <ArrowUpDown className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alphabetical">가나다순</SelectItem>
              <SelectItem value="recently-modified">최근 수정순</SelectItem>
              <SelectItem value="recently-created">최근 생성순</SelectItem>
              <SelectItem value="recently-viewed">최근 조회순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="px-2 py-1 flex-1 overflow-y-auto tree-container">
          <Tree
            value={buildTreeData}
            nodeTemplate={nodeTemplate}
            dragdropScope="demo"
            onDragDrop={onDragDrop}
            onSelect={onNodeSelect}
            selectionMode="single"
            selectionKeys={selectedKeys}
            onSelectionChange={(e) => setSelectedKeys(e.value as string)}
            expandedKeys={expandedKeys}
            onToggle={(e) => setExpandedKeys(e.value)}
            className="w-full border-none bg-transparent h-full"
            style={{ padding: '0px', height: '100%' }}
          />
          
          {buildTreeData.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다." : "메모가 없습니다."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
