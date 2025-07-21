import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemoContextMenu } from '@/components/memo-context-menu';
import { 
  FolderPlus, 
  FilePlus, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Menu,
  FileText,
  Folder as FolderIcon,
  Trash2
} from 'lucide-react';
import type { Memo, Folder, SortOption, GeneralMemo } from '@/types';
import { createNewMemo, generateFolderId } from '@/lib/memo-utils';

type VirtualFolder = {
  id: string;
  name: string;
  type: 'virtual-folder';
  children?: VirtualFolder[];
  memos?: Memo[];
};

export function Sidebar() {
  const { 
    user, 
    memos, 
    folders, 
    currentMemoId, 
    currentFolderId,
    setCurrentMemoId, 
    setCurrentFolderId,
    sidebarCollapsed, 
    setSidebarCollapsed,
    sortOption,
    setSortOption,
    addMemo,
    addFolder,
    setFolders,
    updateMemo,
    deleteFolder
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{ type: 'memo' | 'folder', id: string } | null>(null);

  if (sidebarCollapsed) {
    return (
      <div className="w-14 border-r bg-card p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(false)}
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const canCreateFolders = user?.mode === '일반';

  const handleCreateNewMemo = () => {
    if (!user) return;
    
    const newMemo = createNewMemo(user.mode, '', {
      title: '새 메모',
      grade: '중1',
      subject: '새 과목',
      year: 2024,
      student: '새 학생',
    });
    
    // 현재 선택된 폴더가 있고, 일반 모드인 경우 해당 폴더에 메모 추가
    if (currentFolderId && user.mode === '일반' && newMemo.mode === '일반') {
      newMemo.folderId = currentFolderId;
    }
    
    addMemo(newMemo);
    setCurrentMemoId(newMemo.id);
  };

  const handleCreateNewFolder = () => {
    if (!user || user.mode !== '일반') return;
    
    const newFolder: Folder = {
      id: generateFolderId(),
      name: '새 폴더',
      createdAt: new Date(),
      parentId: currentFolderId || undefined,
    };
    
    addFolder(newFolder);
  };

  // Utility functions
  const getSubfolders = (parentId: string | null): Folder[] => {
    return folders.filter(folder => folder.parentId === parentId);
  };

  const getFolderPath = (folderId: string): string[] => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    if (!folder.parentId) return [folder.name];
    return [...getFolderPath(folder.parentId), folder.name];
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'memo' | 'folder', id: string) => {
    setDraggedItem({ type, id });
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const { type, id } = draggedItem;
    
    if (type === 'memo') {
      const memo = memos.find(m => m.id === id);
      if (memo && memo.mode === '일반') {
        updateMemo(id, { folderId: targetFolderId || undefined });
      }
    } else if (type === 'folder') {
      const folder = folders.find(f => f.id === id);
      if (folder && id !== targetFolderId) {
        // Check for circular reference
        if (targetFolderId) {
          const targetPath = getFolderPath(targetFolderId);
          if (!targetPath.includes(folder.name)) {
            const updatedFolders = folders.map(f => 
              f.id === id ? { ...f, parentId: targetFolderId } : f
            );
            setFolders(updatedFolders);
          }
        } else {
          const updatedFolders = folders.map(f => 
            f.id === id ? { ...f, parentId: undefined } : f
          );
          setFolders(updatedFolders);
        }
      }
    }
    
    setDraggedItem(null);
  };

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(currentFolderId === folderId ? null : folderId);
    if (expandedFolders.has(folderId)) {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    } else {
      setExpandedFolders(prev => new Set([...prev, folderId]));
    }
  };

  const getMemoTitle = (memo: Memo): string => {
    switch (memo.mode) {
      case '일반':
        return memo.title || '제목 없음';
      case '학생':
      case '교사':
        return memo.displayTitle || '제목 없음';
      default:
        return '제목 없음';
    }
  };

  // Filter memos
  const filteredMemos = memos.filter(memo => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const title = getMemoTitle(memo);
    
    return title.toLowerCase().includes(searchLower) ||
           memo.content.toLowerCase().includes(searchLower);
  });

  // Sort memos
  const sortedMemos = [...filteredMemos].sort((a, b) => {
    switch (sortOption) {
      case 'alphabetical': {
        const aTitle = getMemoTitle(a);
        const bTitle = getMemoTitle(b);
        return aTitle.localeCompare(bTitle, 'ko');
      }
      case 'recently-created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'recently-viewed':
        return new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime();
      case 'recently-modified':
      default:
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
    }
  });

  // Get grouped data for student/teacher modes
  const getGroupedMemos = () => {
    if (user?.mode === '학생') {
      const gradeGroups = new Map<string, Memo[]>();
      sortedMemos.forEach(memo => {
        if (memo.mode === '학생') {
          if (!gradeGroups.has(memo.grade)) {
            gradeGroups.set(memo.grade, []);
          }
          gradeGroups.get(memo.grade)?.push(memo);
        }
      });
      return Array.from(gradeGroups.entries()).map(([grade, memos]) => ({
        id: grade,
        name: grade,
        type: 'virtual-folder' as const,
        memos,
      }));
    } else if (user?.mode === '교사') {
      const yearGroups = new Map<number, Map<string, Map<string, Memo[]>>>();
      sortedMemos.forEach(memo => {
        if (memo.mode === '교사') {
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
      
      const result: VirtualFolder[] = [];
      yearGroups.forEach((gradeMap, year) => {
        const yearFolder: VirtualFolder = {
          id: year.toString(),
          name: year.toString(),
          type: 'virtual-folder',
          children: [],
        };
        
        gradeMap.forEach((subjectMap, grade) => {
          const gradeFolder: VirtualFolder = {
            id: `${year}-${grade}`,
            name: grade,
            type: 'virtual-folder',
            children: [],
          };
          
          subjectMap.forEach((memos, subject) => {
            gradeFolder.children?.push({
              id: `${year}-${grade}-${subject}`,
              name: subject,
              type: 'virtual-folder',
              memos,
            });
          });
          
          yearFolder.children?.push(gradeFolder);
        });
        
        result.push(yearFolder);
      });
      
      return result;
    }
    return [];
  };

  // Render virtual folder tree for student/teacher modes
  const renderVirtualFolderTree = (items: VirtualFolder[], depth: number = 0): React.ReactElement[] => {
    const elements: React.ReactElement[] = [];
    
    items.forEach(item => {
      if (item.type === 'virtual-folder') {
        const isExpanded = expandedFolders.has(item.id);
        const hasChildren = item.children && item.children.length > 0;
        const hasMemos = item.memos && item.memos.length > 0;
        
        elements.push(
          <div
            key={item.id}
            className="group relative"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <div
              className="flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-sm"
              onClick={() => {
                if (expandedFolders.has(item.id)) {
                  setExpandedFolders(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(item.id);
                    return newSet;
                  });
                } else {
                  setExpandedFolders(prev => new Set([...prev, item.id]));
                }
              }}
            >
              {(hasChildren || hasMemos) && (
                <button className="p-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              {!(hasChildren || hasMemos) && <div className="w-4" />}
              <FolderIcon className="h-4 w-4 text-blue-500" />
              <span className="text-sm flex-1 truncate">{item.name}</span>
            </div>
          </div>
        );
        
        if (isExpanded) {
          if (hasChildren && item.children) {
            elements.push(...renderVirtualFolderTree(item.children, depth + 1));
          }
          
          if (hasMemos && item.memos) {
            item.memos.forEach((memo: Memo) => {
              const isSelected = currentMemoId === memo.id;
              
              elements.push(
                <div
                  key={memo.id}
                  className={`group relative ${isSelected ? 'bg-primary/10' : ''}`}
                  style={{ paddingLeft: `${(depth + 1) * 12 + 32}px` }}
                >
                  <div
                    className={`flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-sm ${
                      isSelected ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => setCurrentMemoId(memo.id)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'memo', memo.id)}
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm flex-1 truncate">{getMemoTitle(memo)}</span>
                    <MemoContextMenu memo={memo} />
                  </div>
                </div>
              );
            });
          }
        }
      }
    });
    
    return elements;
  };
  const renderFolderTree = (parentId: string | null, depth: number = 0): React.ReactElement[] => {
    const subfolders = getSubfolders(parentId);
    const folderMemos = sortedMemos.filter(memo => {
      if (memo.mode !== '일반') return false;
      const generalMemo = memo as GeneralMemo;
      return generalMemo.folderId === parentId;
    });

    const elements: React.ReactElement[] = [];

    // Render subfolders
    subfolders.forEach(folder => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = currentFolderId === folder.id;
      const hasChildren = getSubfolders(folder.id).length > 0 || 
                         sortedMemos.some(memo => {
                           if (memo.mode !== '일반') return false;
                           const generalMemo = memo as GeneralMemo;
                           return generalMemo.folderId === folder.id;
                         });

      elements.push(
        <div
          key={folder.id}
          className={`group relative ${isSelected ? 'bg-accent' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <div
            className={`flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-sm ${
              isSelected ? 'bg-accent' : ''
            }`}
            onClick={() => handleFolderClick(folder.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, folder.id)}
          >
            {hasChildren && (
              <button className="p-0.5">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            <FolderIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm flex-1 truncate">{folder.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 p-1 h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );

      if (isExpanded) {
        elements.push(...renderFolderTree(folder.id, depth + 1));
      }
    });

    // Render memos in this folder
    folderMemos.forEach(memo => {
      const isSelected = currentMemoId === memo.id;
      
      elements.push(
        <div
          key={memo.id}
          className={`group relative ${isSelected ? 'bg-primary/10' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 32}px` }}
        >
          <div
            className={`flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-sm ${
              isSelected ? 'bg-primary/10' : ''
            }`}
            onClick={() => setCurrentMemoId(memo.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, 'memo', memo.id)}
          >
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm flex-1 truncate">{getMemoTitle(memo)}</span>
            <MemoContextMenu memo={memo} />
          </div>
        </div>
      );
    });

    return elements;
  };

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">메모</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="메모 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recently-modified">최근 수정순</SelectItem>
            <SelectItem value="recently-created">최근 생성순</SelectItem>
            <SelectItem value="recently-viewed">최근 열람순</SelectItem>
            <SelectItem value="alphabetical">이름순</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateNewMemo}
            className="flex-1"
          >
            <FilePlus className="h-4 w-4 mr-2" />
            메모
          </Button>
          {canCreateFolders && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNewFolder}
              className="flex-1"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              폴더
            </Button>
          )}
        </div>

        {currentFolderId && (
          <div className="mt-2 text-xs text-muted-foreground">
            현재 폴더: {folders.find(f => f.id === currentFolderId)?.name}
          </div>
        )}
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
      >
        {user?.mode === '일반' ? (
          // 일반 모드: 폴더 구조로 표시
          <div className="p-2">
            {renderFolderTree(null)}
          </div>
        ) : (
          // 학생/교사 모드: 자동 폴더 구조로 표시
          <div className="p-2">
            {(user?.mode === '학생' || user?.mode === '교사') ? (
              renderVirtualFolderTree(getGroupedMemos())
            ) : (
              // Fallback for other modes
              sortedMemos.map(memo => {
                const isSelected = currentMemoId === memo.id;
                
                return (
                  <div
                    key={memo.id}
                    className={`flex items-center gap-2 p-2 hover:bg-accent/50 cursor-pointer rounded-sm ${
                      isSelected ? 'bg-primary/10' : ''
                    }`}
                    onClick={() => setCurrentMemoId(memo.id)}
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm flex-1 truncate">{getMemoTitle(memo)}</span>
                    <MemoContextMenu memo={memo} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {sortedMemos.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? '검색 결과가 없습니다.' : '메모가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
}
