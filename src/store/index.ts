import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Memo, Folder, SortOption } from "../types";
import { GoogleDriveService } from "../lib/google-drive";
import { reorderVersionNumbers } from "../lib/memo-utils";

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

  // Preserved mode attributes for mode switching
  preservedAttributes: {
    year?: number;
    grade?: string;
    subject?: string;
    student?: string;
    title?: string;
  };
  setPreservedAttributes: (attrs: Partial<AppState['preservedAttributes']>) => void;
  clearPreservedAttributes: () => void;

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

  // Auto-save settings
  autoSaveInterval: number; // in minutes, 0 means disabled
  setAutoSaveInterval: (interval: number) => void;
  lastSavedAt: Date | null;
  setLastSavedAt: (date: Date | null) => void;
  isAutoSaved: boolean; // 마지막 저장이 자동 저장인지 여부
  setIsAutoSaved: (isAutoSaved: boolean) => void;

  // Draft state for unsaved changes
  isDraft: boolean;
  setIsDraft: (isDraft: boolean) => void;

  // Google Drive sync
  googleDriveFolderId: string | null;
  googleDriveFolderName: string;
  googleDriveLoaded: boolean;
  setGoogleDriveFolderId: (folderId: string | null) => void;
  setGoogleDriveFolderName: (name: string) => void;
  setGoogleDriveLoaded: (loaded: boolean) => void;
  loadMemosFromDrive: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // User state
      user: null,
      setUser: (user) => set((state) => {
        // Reset Google Drive loaded state when user logs out
        if (!user?.isLoggedIn && state.user?.isLoggedIn) {
          // User is logging out
          GoogleDriveService.resetLoadingStates();
        }
        
        return {
          user,
          googleDriveLoaded: user?.isLoggedIn ? state.googleDriveLoaded : false
        };
      }),

      // UI state
      loginModalDismissed: false,
      setLoginModalDismissed: (dismissed) => set({ loginModalDismissed: dismissed }),

      // Memos state
      memos: [],
      currentMemoId: null,
      setMemos: (memos) => set({ memos }),
      addMemo: (memo) =>
        set((state) => {
          // Check for duplicate titles in general mode
          if (memo.mode === "일반") {
            const existingTitleMemo = state.memos.find(
              (m) => m.mode === "일반" && m.title === memo.title && m.id !== memo.id
            );
            if (existingTitleMemo) {
              // Add a suffix to make it unique
              let counter = 2;
              let newTitle = `${memo.title} (${counter})`;
              while (state.memos.some((m) => m.mode === "일반" && m.title === newTitle)) {
                counter++;
                newTitle = `${memo.title} (${counter})`;
              }
              memo.title = newTitle;
            }
          }

          // Auto-save to Google Drive if user is logged in
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            if (googleDrive.isAuthenticated()) {
              console.log("Auto-saving new memo to Google Drive:", memo.id);
              GoogleDriveService.saveMemo(memo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
            } else {
              console.log("Google Drive not authenticated, skipping auto-save");
            }
          }

          return { memos: [...state.memos, memo] };
        }),
      updateMemo: (id, updates) =>
        set((state) => {
          const updatedMemos = state.memos.map((memo) => {
            if (memo.id === id) {
              // Type-safe memo updating
              const updatedMemo = { ...memo, ...updates, modifiedAt: new Date() } as Memo;

              // Auto-save to Google Drive if user is logged in
              if (state.user?.isLoggedIn) {
                const googleDrive = GoogleDriveService.getInstance();
                if (googleDrive.isAuthenticated()) {
                  console.log("Auto-saving memo to Google Drive:", updatedMemo.id);
                  GoogleDriveService.saveMemo(updatedMemo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
                } else {
                  console.log("Google Drive not authenticated, skipping auto-save");
                }
              }

              return updatedMemo;
            }
            return memo;
          });

          return { memos: updatedMemos };
        }),
      deleteMemo: (id) =>
        set((state) => {
          const memoToDelete = state.memos.find(memo => memo.id === id);
          
          if (!memoToDelete) {
            return state; // 메모를 찾을 수 없으면 상태 변경 없음
          }

          // Auto-delete from Google Drive if user is logged in
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            if (googleDrive.isAuthenticated()) {
              console.log("Auto-deleting memo from Google Drive:", memoToDelete.id);
              GoogleDriveService.deleteMemo(memoToDelete).catch(console.error);
            } else {
              console.log("Google Drive not authenticated, skipping auto-delete");
            }
          }

          // 버전 번호 재정렬
          const memosAfterDeletion = state.memos.filter((memo) => memo.id !== id);
          const reorderedMemos = reorderVersionNumbers(memoToDelete, memosAfterDeletion);

          // 변경된 메모들을 Google Drive에 저장
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            if (googleDrive.isAuthenticated()) {
              // 버전 번호가 변경된 메모들만 다시 저장
              const originalMemos = memosAfterDeletion;
              reorderedMemos.forEach((memo: Memo) => {
                const originalMemo = originalMemos.find(m => m.id === memo.id);
                if (originalMemo && originalMemo.version !== memo.version) {
                  console.log(`Auto-updating reordered memo ${memo.id} (version ${originalMemo.version} -> ${memo.version})`);
                  GoogleDriveService.saveMemo(memo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
                }
              });
            }
          }

          return {
            memos: reorderedMemos,
            currentMemoId: state.currentMemoId === id ? null : state.currentMemoId,
          };
        }),
      setCurrentMemoId: (id) => {
        set({ currentMemoId: id });
        // Update viewed timestamp without triggering Google Drive save
        if (id) {
          set((state) => ({
            memos: state.memos.map((memo) =>
              memo.id === id
                ? { ...memo, viewedAt: new Date() }
                : memo
            ),
          }));
        }
      },

      // Folders state
      folders: [],
      currentFolderId: null,
      setFolders: (folders) => set({ folders }),
      addFolder: (folder) =>
        set((state) => {
          console.log("Store에 폴더 추가:", folder);
          return { folders: [...state.folders, folder] };
        }),
      deleteFolder: (id) => set((state) => ({ folders: state.folders.filter((f) => f.id !== id) })),
      setCurrentFolderId: (id) => set({ currentFolderId: id }),

      // Preserved mode attributes
      preservedAttributes: {},
      setPreservedAttributes: (attrs) => set((state) => ({ 
        preservedAttributes: { ...state.preservedAttributes, ...attrs } 
      })),
      clearPreservedAttributes: () => set({ preservedAttributes: {} }),

      // UI state
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      sortOption: "recently-modified",
      setSortOption: (option) => set({ sortOption: option }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Local storage
      localMemo: "",
      setLocalMemo: (content) => set({ localMemo: content }),

      // Auto-save settings
      autoSaveInterval: 5, // Default 5 minutes
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      lastSavedAt: null,
      setLastSavedAt: (date) => set({ lastSavedAt: date }),
      isAutoSaved: false,
      setIsAutoSaved: (isAutoSaved) => set({ isAutoSaved }),

      // Draft state
      isDraft: false,
      setIsDraft: (isDraft) => set({ isDraft }),

      // Google Drive integration
      googleDriveFolderId: null,
      googleDriveFolderName: "NEIS Mate",
      googleDriveLoaded: false,
      setGoogleDriveFolderId: (folderId) => set({ googleDriveFolderId: folderId }),
      setGoogleDriveFolderName: (name) => set({ googleDriveFolderName: name }),
      setGoogleDriveLoaded: (loaded) => set({ googleDriveLoaded: loaded }),
      loadMemosFromDrive: async () => {
        const state = get();
        
        console.log("Store: Requesting memos from Google Drive...");
        console.log("Store: Current memo count before loading:", state.memos.length);

        // Load memos from Google Drive (duplicate prevention handled at service level)
        const memosFromDrive = await GoogleDriveService.loadMemos(state.googleDriveFolderId || undefined);
        
        // Only update if we got memos back (empty array might mean duplicate request was blocked)
        if (memosFromDrive.length > 0) {
          console.log("Store: Loaded memos from Google Drive:", memosFromDrive.length);
          
          // Replace existing memos with Google Drive memos and mark as loaded
          // Google Drive is the source of truth, so we completely replace local memos
          set({ 
            memos: memosFromDrive,
            googleDriveLoaded: true
          });
          
          console.log("Store: Updated memo count after loading:", memosFromDrive.length);
        } else if (!state.googleDriveLoaded) {
          // If no memos and not yet loaded, still mark as loaded to prevent retries
          console.log("Store: No memos found, marking as loaded");
          set({ googleDriveLoaded: true });
        } else {
          console.log("Store: Empty result from duplicate request, ignoring");
        }
      },
    }),
    {
      name: "nice-notes-storage",
      partialize: (state) => ({
        user: state.user,
        memos: state.memos,
        folders: state.folders,
        currentFolderId: state.currentFolderId,
        darkMode: state.darkMode,
        sortOption: state.sortOption,
        localMemo: state.localMemo,
        loginModalDismissed: state.loginModalDismissed,
        preservedAttributes: state.preservedAttributes,
        googleDriveFolderId: state.googleDriveFolderId,
        googleDriveFolderName: state.googleDriveFolderName,
      }),
    }
  )
);
