// Google Drive API utilities
import type { Memo, UserMode } from "@/types";

interface GoogleAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
  size?: string;
}

interface GoogleDriveRevision {
  id: string;
  modifiedTime: string;
  size?: string;
}

interface UserConfig {
  mode: UserMode;
  lastModified?: string;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private static isLoading: boolean = false;
  private static hasLoaded: boolean = false;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: GoogleAuthConfig;

  private constructor() {
    this.config = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || "http://localhost:5173/auth/callback",
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    };

    // 페이지 로드 시 저장된 토큰 복원
    this.loadTokensFromStorage();
  }

  static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  private saveTokensToStorage(tokens: GoogleTokenResponse): void {
    const expiry = Date.now() + tokens.expires_in * 1000;

    localStorage.setItem("google_access_token", tokens.access_token);
    localStorage.setItem("google_token_expiry", expiry.toString());

    if (tokens.refresh_token) {
      localStorage.setItem("google_refresh_token", tokens.refresh_token);
    }

    this.accessToken = tokens.access_token;
    this.tokenExpiry = expiry;
  }

  private loadTokensFromStorage(): void {
    const accessToken = localStorage.getItem("google_access_token");
    const expiry = localStorage.getItem("google_token_expiry");

    if (accessToken && expiry) {
      this.accessToken = accessToken;
      this.tokenExpiry = parseInt(expiry);

      // 토큰이 만료되었는지 확인
      if (Date.now() >= this.tokenExpiry) {
        this.clearTokens();
      }
    }
  }

  private clearTokens(): void {
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_refresh_token");
    localStorage.removeItem("google_token_expiry");

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async initializeAuth(): Promise<boolean> {
    try {
      // 현재 URL이 콜백 URL인지 확인
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const error = urlParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        return false;
      }

      if (code) {
        // 인증 코드를 토큰으로 교환
        const success = await this.exchangeCodeForToken(code);
        if (success) {
          // URL에서 코드 파라미터 제거
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return success;
      }

      // 이미 유효한 토큰이 있는지 확인
      if (this.isAuthenticated()) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to initialize Google Auth:", error);
      return false;
    }
  }

  isAuthenticated(): boolean {
    // 먼저 저장된 토큰 확인
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return true;
    }
    
    // 로컬 스토리지에서 토큰 다시 로드 시도
    this.loadTokensFromStorage();
    return !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }

  async startAuthFlow(): Promise<void> {
    const authUrl = this.buildAuthUrl();
    window.location.href = authUrl;
  }

  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<boolean> {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          code,
          grant_type: "authorization_code",
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to exchange code for token");
      }

      const tokens: GoogleTokenResponse = await response.json();
      this.saveTokensToStorage(tokens);
      return true;
    } catch (error) {
      console.error("Token exchange failed:", error);
      return false;
    }
  }

  async getUserInfo(): Promise<GoogleUserInfo | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get user info");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get user info:", error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.accessToken) {
        // Google에서 토큰 무효화
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: "POST",
        });
      }
    } catch (error) {
      console.error("Failed to revoke token:", error);
    } finally {
      this.clearTokens();
      // Reset loading states
      GoogleDriveService.isLoading = false;
      GoogleDriveService.hasLoaded = false;
    }
  }

  // Reset loading states (for logout or testing)
  static resetLoadingStates(): void {
    GoogleDriveService.isLoading = false;
    GoogleDriveService.hasLoaded = false;
    console.log("GoogleDrive: Loading states reset");
  }

  async listFiles(folderId?: string): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const query = folderId ? `'${folderId}' in parents` : "";
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          query
        )}&fields=files(id,name,mimeType,parents,createdTime,modifiedTime,size)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to list files");
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error("Failed to list files:", error);
      throw error;
    }
  }

  async createFile(name: string, content: string, parentId?: string, mimeType: string = "text/plain"): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const metadata = {
        name,
        parents: parentId ? [parentId] : undefined,
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([content], { type: mimeType }));

      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,createdTime,modifiedTime,size",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: form,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create file: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to create file: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Successfully created file:', result);
      return result;
    } catch (error) {
      console.error("Failed to create file:", error);
      throw error;
    }
  }

  async updateFile(fileId: string, content: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,parents,createdTime,modifiedTime,size`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "text/plain",
          },
          body: content,
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update file");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to update file:", error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const metadata = {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      };

      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,createdTime,modifiedTime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create folder");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to create folder:", error);
      throw error;
    }
  }

  // 파일 내용 읽기
  async getFileContent(fileId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get file content");
      }

      return await response.text();
    } catch (error) {
      console.error("Failed to get file content:", error);
      throw error;
    }
  }

  // 폴더 정보 가져오기
  async getFolderInfo(folderId: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,createdTime,modifiedTime`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get folder info");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get folder info:", error);
      throw error;
    }
  }

  // 폴더 이름 변경
  async renameFolder(folderId: string, newName: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const metadata = {
        name: newName,
      };

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,createdTime,modifiedTime`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rename folder");
      }

      const result = await response.json();
      console.log('Successfully renamed folder:', result);
      return result;
    } catch (error) {
      console.error("Failed to rename folder:", error);
      throw error;
    }
  }

  // NEIS Mate 폴더 생성 또는 찾기 (전체 드라이브에서 검색)
  async ensureNeisMateFolder(): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      // 전체 드라이브에서 NEIS Mate 폴더 검색 (위치 상관없이)
      const query = "name='NEIS Mate' and mimeType='application/vnd.google-apps.folder' and trashed=false";
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search for NEIS Mate folder");
      }

      const data = await response.json();
      const existingFolders = data.files || [];

      if (existingFolders.length > 0) {
        // 이미 존재하는 경우 첫 번째 폴더 ID 반환
        const folder = existingFolders[0];
        console.log("Found existing NEIS Mate folder:", folder.id, 
          folder.parents ? `(moved to: ${folder.parents[0]})` : "(in root)");
        return folder.id;
      } else {
        // 폴더가 없으면 루트에 생성
        console.log("Creating new NEIS Mate folder in root");
        const folder = await this.createFolder("NEIS Mate");
        return folder.id;
      }
    } catch (error) {
      console.error("Failed to ensure NEIS Mate folder:", error);
      throw error;
    }
  }

  // 지정된 폴더 내에서 파일들 검색
  async searchMemoFiles(query: string, folderId?: string): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      let searchQuery = `name contains '${query}' and mimeType='application/json'`;
      if (folderId) {
        searchQuery += ` and '${folderId}' in parents`;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          searchQuery
        )}&fields=files(id,name,mimeType,parents,createdTime,modifiedTime,size)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search files");
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error("Failed to search files:", error);
      throw error;
    }
  }

  // 파일 버전 히스토리 가져오기
  async getFileRevisions(fileId: string): Promise<GoogleDriveRevision[]> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,size)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get file revisions");
      }

      const data = await response.json();
      return data.revisions || [];
    } catch (error) {
      console.error("Failed to get file revisions:", error);
      throw error;
    }
  }

  // 특정 버전의 파일 내용 가져오기
  async getRevisionContent(fileId: string, revisionId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get revision content");
      }

      return await response.text();
    } catch (error) {
      console.error("Failed to get revision content:", error);
      throw error;
    }
  }

  // 특정 폴더 내에서 하위 폴더 찾기 또는 생성
  async ensureSubFolder(parentFolderId: string, folderName: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error("Not authenticated");
    }

    try {
      // 부모 폴더 내에서 해당 이름의 폴더 검색
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search for subfolder");
      }

      const data = await response.json();
      const existingFolders = data.files || [];

      if (existingFolders.length > 0) {
        // 이미 존재하는 경우 첫 번째 폴더 ID 반환
        console.log(`Found existing subfolder '${folderName}':`, existingFolders[0].id);
        return existingFolders[0].id;
      } else {
        // 폴더가 없으면 생성
        console.log(`Creating new subfolder '${folderName}' in parent: ${parentFolderId}`);
        const folder = await this.createFolder(folderName, parentFolderId);
        return folder.id;
      }
    } catch (error) {
      console.error(`Failed to ensure subfolder '${folderName}':`, error);
      throw error;
    }
  }

  // 사용자 설정 정보를 Google Drive에 저장/로드
  static async saveUserConfig(config: UserConfig): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return;
    }

    try {
      const folderId = await instance.ensureNeisMateFolder();
      const fileName = "user-config.json";
      const content = JSON.stringify(config, null, 2);

      // Check if config file already exists
      const existingFiles = await instance.searchMemoFiles(fileName, folderId);
      
      if (existingFiles.length > 0) {
        // Update existing config
        console.log("Updating user config in Google Drive");
        await instance.updateFile(existingFiles[0].id, content);
      } else {
        // Create new config file
        console.log("Creating user config in Google Drive");
        await instance.createFile(fileName, content, folderId, "application/json");
      }
    } catch (error) {
      console.error("Failed to save user config to Drive:", error);
    }
  }

  static async loadUserConfig(): Promise<UserConfig | null> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return null;
    }

    try {
      const folderId = await instance.ensureNeisMateFolder();
      const fileName = "user-config.json";
      
      // Look for config file
      const files = await instance.searchMemoFiles(fileName, folderId);
      
      if (files.length > 0) {
        const content = await instance.getFileContent(files[0].id);
        return JSON.parse(content) as UserConfig;
      }
      
      return null;
    } catch (error) {
      console.error("Failed to load user config from Drive:", error);
      return null;
    }
  }

  // 사용자에게 기존 데이터가 있는지 확인 (메모 또는 설정 파일)
  static async hasExistingData(): Promise<boolean> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return false;
    }

    try {
      const folderId = await instance.ensureNeisMateFolder();
      const files = await instance.listFiles(folderId);
      
      // JSON 파일이 있는지 확인 (메모 파일 또는 설정 파일)
      const hasJsonFiles = files.some(file => file.name.endsWith(".json"));
      
      if (hasJsonFiles) {
        console.log("Found existing data in Google Drive");
        return true;
      }
      
      // 하위 폴더도 확인
      const subFolders = files.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );
      
      for (const folder of subFolders) {
        const subFiles = await instance.listFiles(folder.id);
        const hasSubJsonFiles = subFiles.some(file => file.name.endsWith(".json"));
        if (hasSubJsonFiles) {
          console.log("Found existing data in Google Drive subfolder");
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Failed to check for existing data:", error);
      return false;
    }
  }

  // 파일을 Google Drive에 저장
  static async saveMemo(memo: Memo, folderId?: string, folders?: Array<{id: string, name: string}>): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    
    // Google Auth 컴포넌트에서 설정한 토큰 확인
    const googleAccessToken = localStorage.getItem("google_access_token");
    if (googleAccessToken && !instance.isAuthenticated()) {
      instance.accessToken = googleAccessToken;
      const expiry = localStorage.getItem("google_token_expiry");
      if (expiry) {
        instance.tokenExpiry = parseInt(expiry);
      }
    }
    
    if (!instance.isAuthenticated()) {
      console.log("Google Drive: Not authenticated, skipping save");
      return;
    }

    try {
      // 기본 폴더 ID 설정
      let baseFolderId = folderId;
      if (!baseFolderId) {
        baseFolderId = await instance.ensureNeisMateFolder();
      }

      let targetFolderId = baseFolderId;

      // 일반 모드의 경우 폴더 구조 반영
      if (memo.mode === "일반" && memo.folderId && folders) {
        const folder = folders.find(f => f.id === memo.folderId);
        if (folder) {
          // 해당 폴더를 Google Drive에서도 생성/찾기
          targetFolderId = await instance.ensureSubFolder(baseFolderId, folder.name);
        }
      }

      const fileName = memo.mode === "일반" ? `${memo.title || 'untitled'}.json` : `${memo.internalTitle || 'untitled'}.json`;
      const content = JSON.stringify(memo, null, 2);

      // First, try to find existing file by memo ID (search in file content)
      let existingFileId: string | null = null;
      
      // Search all JSON files in the target folder
      const allFiles = await instance.listFiles(targetFolderId);
      const jsonFiles = allFiles.filter(file => file.name.endsWith('.json') && file.name !== 'user-config.json');
      
      for (const file of jsonFiles) {
        try {
          const fileContent = await instance.getFileContent(file.id);
          const fileMemo = JSON.parse(fileContent);
          if (fileMemo.id === memo.id) {
            existingFileId = file.id;
            console.log(`Found existing memo file by ID: ${file.name} -> ${fileName}`);
            break;
          }
        } catch {
          // Skip files that can't be parsed
          console.warn(`Skipping unparseable file: ${file.name}`);
        }
      }

      if (existingFileId) {
        // Update existing file (this will also update the filename if needed)
        console.log(`Updating existing memo file: ${fileName}`);
        
        // If the filename has changed, we need to rename the file
        const currentFile = allFiles.find(f => f.id === existingFileId);
        if (currentFile && currentFile.name !== fileName) {
          // Update both content and filename
          await instance.updateFile(existingFileId, content);
          // Rename the file by updating its metadata
          await fetch(`https://www.googleapis.com/drive/v3/files/${existingFileId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${instance.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: fileName }),
          });
          console.log(`Renamed file from ${currentFile.name} to ${fileName}`);
        } else {
          // Just update content
          await instance.updateFile(existingFileId, content);
        }
      } else {
        // Create new file in the target folder
        console.log(`Creating new memo file: ${fileName} in folder: ${targetFolderId}`);
        await instance.createFile(fileName, content, targetFolderId, "application/json");
      }
      
      console.log(`Successfully saved memo to Google Drive: ${fileName}`);
    } catch (error) {
      console.error("Failed to save memo to Drive:", error);
    }
  }

  // Google Drive에서 메모 파일 삭제
  static async deleteMemo(memo: Memo): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    
    // Google Auth 컴포넌트에서 설정한 토큰 확인
    const googleAccessToken = localStorage.getItem("google_access_token");
    if (googleAccessToken && !instance.isAuthenticated()) {
      instance.accessToken = googleAccessToken;
      const expiry = localStorage.getItem("google_token_expiry");
      if (expiry) {
        instance.tokenExpiry = parseInt(expiry);
      }
    }
    
    if (!instance.isAuthenticated()) {
      console.log("Google Drive: Not authenticated, skipping delete");
      return;
    }

    try {
      const fileName = memo.mode === "일반" ? `${memo.title || 'untitled'}.json` : `${memo.internalTitle || 'untitled'}.json`;
      
      // Search for the file by memo ID (not by filename)
      const folderId = await instance.ensureNeisMateFolder();
      
      // Search all JSON files in the NEIS Mate folder and subfolders
      let fileToDelete: string | null = null;
      
      const searchInFolder = async (searchFolderId: string): Promise<string | null> => {
        const files = await instance.listFiles(searchFolderId);
        const jsonFiles = files.filter(file => file.name.endsWith('.json') && file.name !== 'user-config.json');
        
        for (const file of jsonFiles) {
          try {
            const fileContent = await instance.getFileContent(file.id);
            const fileMemo = JSON.parse(fileContent);
            if (fileMemo.id === memo.id) {
              return file.id;
            }
          } catch {
            // Skip files that can't be parsed
          }
        }
        
        // Search in subfolders
        const subFolders = files.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
        for (const folder of subFolders) {
          const foundInSubfolder = await searchInFolder(folder.id);
          if (foundInSubfolder) {
            return foundInSubfolder;
          }
        }
        
        return null;
      };
      
      fileToDelete = await searchInFolder(folderId);
      
      if (fileToDelete) {
        // Delete the file
        await instance.deleteFile(fileToDelete);
        console.log(`Successfully deleted memo from Google Drive: ${fileName} (ID: ${memo.id})`);
      } else {
        console.log(`Memo file not found in Google Drive: ${fileName} (ID: ${memo.id})`);
      }
    } catch (error) {
      console.error("Failed to delete memo from Drive:", error);
    }
  }

  // Google Drive에서 파일 로드 (폴더 구조 포함)
  static async loadMemos(folderId?: string): Promise<Memo[]> {
    // Prevent concurrent loading
    if (GoogleDriveService.isLoading) {
      console.log("GoogleDrive: Already loading, skipping duplicate request");
      return [];
    }

    // Prevent loading if already loaded (unless forced)
    if (GoogleDriveService.hasLoaded) {
      console.log("GoogleDrive: Already loaded, skipping duplicate request");
      return [];
    }

    GoogleDriveService.isLoading = true;

    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      GoogleDriveService.isLoading = false;
      return [];
    }

    try {
      console.log("GoogleDrive: Starting memo loading process");
      // 폴더 ID가 제공되지 않으면 NEIS Mate 폴더 사용
      let targetFolderId = folderId;
      if (!targetFolderId) {
        targetFolderId = await instance.ensureNeisMateFolder();
      }

      const memos: Memo[] = [];
      const seenMemoIds = new Set<string>(); // 중복 방지를 위한 ID 추적

      // 루트 폴더에서 직접 메모 파일들 가져오기
      const rootFiles = await instance.listFiles(targetFolderId);
      for (const file of rootFiles) {
        // 설정 파일은 제외하고 메모 파일만 처리
        if (file.name.endsWith(".json") && file.name !== "user-config.json") {
          try {
            const content = await instance.getFileContent(file.id);
            const memo = JSON.parse(content);
            
            // ID 중복 체크
            if (memo.id && !seenMemoIds.has(memo.id)) {
              seenMemoIds.add(memo.id);
              memos.push(memo);
              console.log(`✓ Loaded memo from root: ${file.name} (ID: ${memo.id})`);
            } else {
              console.warn(`⚠ Skipping duplicate memo in root: ${file.name} (ID: ${memo.id || 'NO_ID'})`);
            }
          } catch (error) {
            console.error(`Failed to parse memo from file ${file.name}:`, error);
          }
        }
      }

      // 하위 폴더들에서도 메모 파일들 가져오기 (일반 모드용)
      const subFolders = rootFiles.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );

      for (const folder of subFolders) {
        const subFiles = await instance.listFiles(folder.id);
        for (const file of subFiles) {
          // 설정 파일은 제외하고 메모 파일만 처리
          if (file.name.endsWith(".json") && file.name !== "user-config.json") {
            try {
              const content = await instance.getFileContent(file.id);
              const memo = JSON.parse(content);
              
              // ID 중복 체크
              if (memo.id && !seenMemoIds.has(memo.id)) {
                seenMemoIds.add(memo.id);
                memos.push(memo);
                console.log(`✓ Loaded memo from subfolder ${folder.name}: ${file.name} (ID: ${memo.id})`);
              } else {
                console.warn(`⚠ Skipping duplicate memo in ${folder.name}: ${file.name} (ID: ${memo.id || 'NO_ID'})`);
              }
            } catch (error) {
              console.error(`Failed to parse memo from file ${file.name} in folder ${folder.name}:`, error);
            }
          }
        }
      }

      console.log(`Total memos loaded from Google Drive: ${memos.length}`);
      GoogleDriveService.hasLoaded = true;
      return memos;
    } catch (error) {
      console.error("Failed to load memos from Drive:", error);
      return [];
    } finally {
      GoogleDriveService.isLoading = false;
    }
  }

  // 파일 동기화
  static async syncMemos(localMemos: Memo[], folderId?: string, folders?: Array<{id: string, name: string}>): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return;
    }

    try {
      // Save all local memos to Drive
      for (const memo of localMemos) {
        await GoogleDriveService.saveMemo(memo, folderId, folders);
      }
    } catch (error) {
      console.error("Failed to sync memos with Drive:", error);
    }
  }
}
