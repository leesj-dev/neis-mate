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
  updateFolder: (id: string, updates: Partial<Folder>) => void;
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
  clearAllData: () => Promise<void>;
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
            googleDrive.isAuthenticated().then(isAuth => {
              if (isAuth) {
                console.log("Auto-saving new memo to Google Drive:", memo.id);
                GoogleDriveService.saveMemo(memo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
              } else {
                console.log("Google Drive not authenticated, skipping auto-save");
              }
            });
          }

          return { memos: [...state.memos, memo] };
        }),
      updateMemo: (id, updates) =>
        set((state) => {
          const updatedMemos = state.memos.map((memo) => {
            if (memo.id === id) {
              const originalMemo = memo;
              // Type-safe memo updating
              const updatedMemo = { ...memo, ...updates, modifiedAt: new Date() } as Memo;

              // Auto-save to Google Drive if user is logged in
              if (state.user?.isLoggedIn) {
                const googleDrive = GoogleDriveService.getInstance();
                googleDrive.isAuthenticated().then(isAuth => {
                  if (isAuth) {
                    // Check if title or folderId changed (requires deletion of old file)
                    let titleChanged = false;
                    let folderChanged = false;

                    if (originalMemo.mode === "일반") {
                      const generalMemo = originalMemo as import("@/types").GeneralMemo;
                      const generalUpdates = updates as Partial<import("@/types").GeneralMemo>;
                      titleChanged = 'title' in updates && generalUpdates.title !== generalMemo.title;
                      folderChanged = 'folderId' in updates && generalUpdates.folderId !== generalMemo.folderId;
                    } else {
                      const nonGeneralMemo = originalMemo as import("@/types").StudentMemo | import("@/types").TeacherMemo;
                      const nonGeneralUpdates = updates as Partial<import("@/types").StudentMemo | import("@/types").TeacherMemo>;
                      titleChanged = 'displayTitle' in updates && nonGeneralUpdates.displayTitle !== nonGeneralMemo.displayTitle;
                    }

                    if (titleChanged || folderChanged) {
                      console.log("Title or folder changed, deleting old file from Google Drive:", originalMemo.id);
                      // Delete the old file first, then save the new one
                      GoogleDriveService.deleteMemo(originalMemo)
                        .then(() => {
                          console.log("Old file deleted, saving updated memo to Google Drive:", updatedMemo.id);
                          return GoogleDriveService.saveMemo(updatedMemo, state.googleDriveFolderId || undefined, state.folders);
                        })
                        .catch(error => {
                          console.error("Failed to delete old memo file from Google Drive:", error);
                          // Still try to save the updated memo even if deletion failed
                          GoogleDriveService.saveMemo(updatedMemo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
                        });
                    } else {
                      console.log("Auto-saving memo to Google Drive:", updatedMemo.id);
                      GoogleDriveService.saveMemo(updatedMemo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
                    }
                  } else {
                    console.log("Google Drive not authenticated, skipping auto-save");
                  }
                });
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

          // 먼저 로컬에서 메모 삭제 및 버전 재정렬
          const memosAfterDeletion = state.memos.filter((memo) => memo.id !== id);
          const reorderedMemos = reorderVersionNumbers(memoToDelete, memosAfterDeletion);

          // Google Drive에서 삭제 (비동기로 처리하되 실패해도 로컬 상태는 유지)
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            googleDrive.isAuthenticated().then(isAuth => {
              if (isAuth) {
                console.log("Auto-deleting memo from Google Drive:", memoToDelete.id);
                GoogleDriveService.deleteMemo(memoToDelete)
                  .then(() => {
                    console.log("Successfully deleted memo from Google Drive:", memoToDelete.id);
                  })
                  .catch(error => {
                    console.error("Failed to delete memo from Google Drive:", memoToDelete.id, error);
                    // Google Drive 삭제 실패해도 로컬 상태는 유지
                  });
                
                // 버전 번호가 변경된 메모들을 Google Drive에 저장
                const originalMemos = memosAfterDeletion;
                reorderedMemos.forEach((memo: Memo) => {
                  const originalMemo = originalMemos.find(m => m.id === memo.id);
                  if (originalMemo && originalMemo.version !== memo.version) {
                    console.log(`Auto-updating reordered memo ${memo.id} (version ${originalMemo.version} -> ${memo.version})`);
                    GoogleDriveService.saveMemo(memo, state.googleDriveFolderId || undefined, state.folders).catch(console.error);
                  }
                });
              } else {
                console.log("Google Drive not authenticated, skipping auto-delete");
              }
            });
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
      setFolders: (folders) => {
        set((state) => {
          // Google Drive에 폴더 변경사항 동기화
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            googleDrive.isAuthenticated().then(isAuth => {
              if (isAuth) {
                console.log("Syncing folder changes to Google Drive");
                // 폴더 변경으로 인해 메모들의 위치가 바뀔 수 있으므로 모든 메모를 다시 저장
                state.memos.forEach(memo => {
                  if (memo.mode === "일반") {
                    GoogleDriveService.saveMemo(memo, state.googleDriveFolderId || undefined, folders).catch(console.error);
                  }
                });
              }
            });
          }
          return { folders };
        });
      },
      addFolder: (folder) =>
        set((state) => {
          console.log("Store에 폴더 추가:", folder);
          return { folders: [...state.folders, folder] };
        }),
      updateFolder: (id: string, updates: Partial<Folder>) =>
        set((state) => {
          console.log("Store에 폴더 업데이트:", id, updates);
          return { 
            folders: state.folders.map(f => 
              f.id === id ? { ...f, ...updates } : f
            )
          };
        }),
      deleteFolder: (id) => {
        set((state) => {
          const folderToDelete = state.folders.find(f => f.id === id);
          
          // Google Drive에서 폴더 삭제
          if (state.user?.isLoggedIn && folderToDelete?.googleDriveId) {
            const googleDrive = GoogleDriveService.getInstance();
            googleDrive.isAuthenticated().then(isAuth => {
              if (isAuth && folderToDelete.googleDriveId) {
                console.log("Deleting folder from Google Drive:", folderToDelete.googleDriveId);
                googleDrive.deleteFolder(folderToDelete.googleDriveId).catch(error => {
                  console.error("Failed to delete folder from Google Drive:", folderToDelete.googleDriveId, error);
                });
              }
            });
          }

          // 해당 폴더에 있는 모든 메모들을 Google Drive에서 삭제
          if (state.user?.isLoggedIn) {
            const googleDrive = GoogleDriveService.getInstance();
            googleDrive.isAuthenticated().then(isAuth => {
              if (isAuth) {
                const memosInFolder = state.memos.filter(memo => 
                  memo.mode === "일반" && (memo as import("@/types").GeneralMemo).folderId === id
                );
                console.log(`Deleting ${memosInFolder.length} memos from Google Drive (folder deletion)`);
                memosInFolder.forEach(memo => {
                  GoogleDriveService.deleteMemo(memo).catch(error => {
                    console.error("Failed to delete memo from Google Drive during folder deletion:", memo.id, error);
                  });
                });
              }
            });
          }
          
          // 해당 폴더에 있는 메모들의 folderId를 null로 변경 (루트로 이동)
          const updatedMemos = state.memos.map(memo => {
            if (memo.mode === "일반" && (memo as import("@/types").GeneralMemo).folderId === id) {
              const updatedMemo = { ...memo, folderId: undefined } as import("@/types").GeneralMemo;
              // Google Drive에 업데이트된 메모 저장 (새 위치에)
              if (state.user?.isLoggedIn) {
                const googleDrive = GoogleDriveService.getInstance();
                googleDrive.isAuthenticated().then(isAuth => {
                  if (isAuth) {
                    GoogleDriveService.saveMemo(updatedMemo, state.googleDriveFolderId || undefined, state.folders.filter(f => f.id !== id)).catch(console.error);
                  }
                });
              }
              return updatedMemo;
            }
            return memo;
          });

          return { 
            folders: state.folders.filter((f) => f.id !== id),
            memos: updatedMemos
          };
        });
      },
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
          
          // 기존 로컬 메모와 Drive 메모를 병합 (ID로 중복 제거)
          const existingMemoIds = new Set(state.memos.map(memo => memo.id));
          const newMemosFromDrive = memosFromDrive.filter(memo => !existingMemoIds.has(memo.id));
          
          // Drive 메모가 더 최신인 경우 업데이트
          const updatedMemos = state.memos.map(localMemo => {
            const driveVersion = memosFromDrive.find(driveMemo => driveMemo.id === localMemo.id);
            if (driveVersion && new Date(driveVersion.modifiedAt) > new Date(localMemo.modifiedAt)) {
              console.log(`Updating local memo ${localMemo.id} with newer version from Drive`);
              return driveVersion;
            }
            return localMemo;
          });
          
          // 새로운 Drive 메모들 추가
          const finalMemos = [...updatedMemos, ...newMemosFromDrive];
          
          set({ 
            memos: finalMemos,
            googleDriveLoaded: true
          });
          
          console.log("Store: Merged memo count after loading:", finalMemos.length);
          console.log("Store: New memos from Drive:", newMemosFromDrive.length);
          console.log("Store: Updated existing memos:", finalMemos.length - state.memos.length - newMemosFromDrive.length);
        } else if (!state.googleDriveLoaded) {
          // If no memos and not yet loaded, still mark as loaded to prevent retries
          console.log("Store: No memos found or loading was skipped, marking as loaded");
          set({ googleDriveLoaded: true });
        }
      },
      clearAllData: async () => {
        const state = get();
        
        if (state.user?.isLoggedIn) {
          try {
            console.log("Store: Clearing all data from Google Drive...");
            await GoogleDriveService.clearAllData();
            console.log("Store: Successfully cleared all data from Google Drive");
          } catch (error) {
            console.error("Store: Failed to clear data from Google Drive:", error);
            // Continue with local clearing even if Google Drive clearing fails
          }
        }
        
        // Clear all local data
        console.log("Store: Clearing all local data...");
        set({
          memos: [],
          folders: [],
          currentMemoId: null,
          currentFolderId: null,
          googleDriveLoaded: false,
          localMemo: "",
          preservedAttributes: {},
          isDraft: false,
          lastSavedAt: null,
          isAutoSaved: false,
        });
        
        // Reset Google Drive loading states
        GoogleDriveService.resetLoadingStates();
        
        console.log("Store: All data cleared successfully");
      },
    }),
    {
      name: "neis-notes-storage",
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
