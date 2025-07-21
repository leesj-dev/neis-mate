// Google Drive API utilities
import type { Memo } from '@/types';

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

interface GoogleDriveFileList {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: GoogleAuthConfig;

  private constructor() {
    this.config = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback',
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
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
    const expiry = Date.now() + (tokens.expires_in * 1000);
    
    localStorage.setItem('google_access_token', tokens.access_token);
    localStorage.setItem('google_token_expiry', expiry.toString());
    
    if (tokens.refresh_token) {
      localStorage.setItem('google_refresh_token', tokens.refresh_token);
    }

    this.accessToken = tokens.access_token;
    this.tokenExpiry = expiry;
    if (tokens.refresh_token) {
      this.refreshToken = tokens.refresh_token;
    }
  }

  private loadTokensFromStorage(): void {
    const accessToken = localStorage.getItem('google_access_token');
    const refreshToken = localStorage.getItem('google_refresh_token');
    const expiry = localStorage.getItem('google_token_expiry');

    if (accessToken && expiry) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.tokenExpiry = parseInt(expiry);

      // 토큰이 만료되었는지 확인
      if (Date.now() >= this.tokenExpiry) {
        this.clearTokens();
      }
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_token_expiry');
    
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  async initializeAuth(): Promise<boolean> {
    try {
      // 현재 URL이 콜백 URL인지 확인
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
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
      console.error('Failed to initialize Google Auth:', error);
      return false;
    }
  }

  isAuthenticated(): boolean {
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
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<boolean> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokens: GoogleTokenResponse = await response.json();
      this.saveTokensToStorage(tokens);
      return true;
    } catch (error) {
      console.error('Token exchange failed:', error);
      return false;
    }
  }

  async getUserInfo(): Promise<GoogleUserInfo | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.accessToken) {
        // Google에서 토큰 무효화
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Failed to revoke token:', error);
    } finally {
      this.clearTokens();
    }
  }

  async listFiles(folderId?: string): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const query = folderId ? `'${folderId}' in parents` : '';
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,createdTime,modifiedTime,size)`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  async createFile(name: string, content: string, parentId?: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const metadata = {
        name,
        parents: parentId ? [parentId] : undefined,
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([content], { type: 'text/plain' }));

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,createdTime,modifiedTime,size',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
          body: form,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create file');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  }

  async updateFile(fileId: string, content: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,mimeType,parents,createdTime,modifiedTime,size`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'text/plain',
          },
          body: content,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update file');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<GoogleDriveFile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      };

      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,createdTime,modifiedTime',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  // 파일 내용 읽기
  async getFileContent(fileId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get file content');
      }

      return await response.text();
    } catch (error) {
      console.error('Failed to get file content:', error);
      throw error;
    }
  }

  // 특정 폴더에서 메모 파일들 검색
  async searchMemoFiles(query: string, folderId?: string): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      let searchQuery = `name contains '${query}' and mimeType='text/plain'`;
      if (folderId) {
        searchQuery += ` and '${folderId}' in parents`;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,parents,createdTime,modifiedTime,size)`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to search files');
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }

  // 파일 버전 히스토리 가져오기
  async getFileRevisions(fileId: string): Promise<GoogleDriveRevision[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,size)`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get file revisions');
      }

      const data = await response.json();
      return data.revisions || [];
    } catch (error) {
      console.error('Failed to get file revisions:', error);
      throw error;
    }
  }

  // 특정 버전의 파일 내용 가져오기
  async getRevisionContent(fileId: string, revisionId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get revision content');
      }

      return await response.text();
    } catch (error) {
      console.error('Failed to get revision content:', error);
      throw error;
    }
  }

  // 메모를 Google Drive에 저장
  static async saveMemo(memo: Memo): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return;
    }

    try {
      const fileName = memo.mode === '일반' ? `${memo.title}.txt` : `${memo.internalTitle}.txt`;
      const content = JSON.stringify(memo, null, 2);
      
      // Check if file already exists
      const existingFiles = await instance.searchMemoFiles(fileName);
      
      if (existingFiles.length > 0) {
        // Update existing file
        await instance.updateFile(existingFiles[0].id, content);
      } else {
        // Create new file
        await instance.createFile(fileName, content);
      }
    } catch (error) {
      console.error('Failed to save memo to Drive:', error);
    }
  }

  // Google Drive에서 메모 로드
  static async loadMemos(): Promise<Memo[]> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return [];
    }

    try {
      const files = await instance.listFiles();
      const memos: Memo[] = [];
      
      for (const file of files) {
        if (file.name.endsWith('.txt')) {
          try {
            const content = await instance.getFileContent(file.id);
            const memo = JSON.parse(content);
            memos.push(memo);
          } catch (error) {
            console.error(`Failed to parse memo from file ${file.name}:`, error);
          }
        }
      }
      
      return memos;
    } catch (error) {
      console.error('Failed to load memos from Drive:', error);
      return [];
    }
  }

  // 메모 동기화
  static async syncMemos(localMemos: Memo[]): Promise<void> {
    const instance = GoogleDriveService.getInstance();
    if (!instance.isAuthenticated()) {
      return;
    }

    try {
      // Save all local memos to Drive
      for (const memo of localMemos) {
        await GoogleDriveService.saveMemo(memo);
      }
    } catch (error) {
      console.error('Failed to sync memos with Drive:', error);
    }
  }
}
