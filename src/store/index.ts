import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Memo, Folder, SortOption } from '../types';
import { GoogleDriveService } from '../lib/google-drive';

interface AppState {
  // User state
  user: User | null;
  setUser: (user: User | null) => void;
  
  // UI state for dismissing login modal
  loginModalDismissed: boolean;
  setLoginModalDismissed: (dismissed: boolean) => void;
  
  // Memos state
  memos: Memo[];
  currentMemoId: string | null;
  setMemos: (memos: Memo[]) => void;
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, updates: Partial<Memo>) => void;
  deleteMemo: (id: string) => void;
  setCurrentMemoId: (id: string | null) => void;
  
  // Folders state (only for 일반 mode)
  folders: Folder[];
  currentFolderId: string | null;
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  deleteFolder: (id: string) => void;
  setCurrentFolderId: (id: string | null) => void;
  
  // UI state
  darkMode: boolean;
  toggleDarkMode: () => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Local storage memo for non-logged users
  localMemo: string;
  setLocalMemo: (content: string) => void;
  
  // Google Drive sync
  syncWithDrive: () => Promise<void>;
  saveMemoToDrive: (memo: Memo) => Promise<void>;
  loadMemosFromDrive: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      setUser: (user) => set({ user }),
      
      // UI state
      loginModalDismissed: false,
      setLoginModalDismissed: (dismissed) => set({ loginModalDismissed: dismissed }),
      
      // Memos state
      memos: [],
      currentMemoId: null,
      setMemos: (memos) => set({ memos }),
      addMemo: (memo) => set((state) => {
    // Check for duplicate titles in general mode
    if (memo.mode === '일반') {
      const existingTitleMemo = state.memos.find(m => 
        m.mode === '일반' && m.title === memo.title && m.id !== memo.id
      );
      if (existingTitleMemo) {
        // Add a suffix to make it unique
        let counter = 2;
        let newTitle = `${memo.title} (${counter})`;
        while (state.memos.some(m => m.mode === '일반' && m.title === newTitle)) {
          counter++;
          newTitle = `${memo.title} (${counter})`;
        }
        memo.title = newTitle;
      }
    }
    
    // Auto-save to Google Drive if user is logged in
    if (state.user?.isLoggedIn) {
      GoogleDriveService.saveMemo(memo).catch(console.error);
    }
    
    return { memos: [...state.memos, memo] };
  }),
      updateMemo: (id, updates) => set((state) => {
        const updatedMemos = state.memos.map(memo => {
          if (memo.id === id) {
            // Type-safe memo updating
            const updatedMemo = { ...memo, ...updates, modifiedAt: new Date() } as Memo;
            
            // Auto-save to Google Drive if user is logged in
            if (state.user?.isLoggedIn) {
              GoogleDriveService.saveMemo(updatedMemo).catch(console.error);
            }
            
            return updatedMemo;
          }
          return memo;
        });
        
        return { memos: updatedMemos };
      }),
      deleteMemo: (id) => set((state) => ({ 
        memos: state.memos.filter(memo => memo.id !== id),
        currentMemoId: state.currentMemoId === id ? null : state.currentMemoId
      })),
      setCurrentMemoId: (id) => {
        set({ currentMemoId: id });
        // Update viewed timestamp
        if (id) {
          const state = get();
          state.updateMemo(id, { viewedAt: new Date() });
        }
      },
      
      // Folders state
      folders: [],
      currentFolderId: null,
      setFolders: (folders) => set({ folders }),
      addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
      deleteFolder: (id) => set((state) => ({ folders: state.folders.filter(f => f.id !== id) })),
      setCurrentFolderId: (id) => set({ currentFolderId: id }),
      
      // UI state
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      sortOption: 'recently-modified',
      setSortOption: (option) => set({ sortOption: option }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      // Local storage
      localMemo: '',
      setLocalMemo: (content) => set({ localMemo: content }),
      
      // Google Drive integration
      syncWithDrive: async () => {
        const state = get();
        const { memos } = state;
        // Sync logic here
        await GoogleDriveService.syncMemos(memos);
      },
      saveMemoToDrive: async (memo) => {
        // Save memo to Google Drive
        await GoogleDriveService.saveMemo(memo);
      },
      loadMemosFromDrive: async () => {
        // Load memos from Google Drive
        const memos = await GoogleDriveService.loadMemos();
        set({ memos });
      },
    }),
    {
      name: 'nice-notes-storage',
      partialize: (state) => ({
        user: state.user,
        memos: state.memos,
        folders: state.folders,
        currentFolderId: state.currentFolderId,
        darkMode: state.darkMode,
        sortOption: state.sortOption,
        localMemo: state.localMemo,
      }),
    }
  )
);
