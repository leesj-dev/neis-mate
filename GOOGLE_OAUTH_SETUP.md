# Google OAuth 2.0 & Drive API Integration Setup Guide

## 완료된 구현 사항 ✅

1. **GoogleDriveService 클래스**: 완전한 OAuth 2.0 인증 및 Drive API 서비스
2. **OAuth 콜백 핸들링**: 자동 토큰 교환 및 사용자 정보 저장
3. **Google Auth 버튼**: 로그인/로그아웃 UI 컴포넌트
4. **Drive API 메서드들**: 파일/폴더 생성, 읽기, 검색 기능

## 1. Google Cloud Console 설정 (필수)

### Step 1: 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성: "Nice Notes App"
3. 프로젝트 선택

### Step 2: API 활성화
1. **APIs & Services** → **Library**
2. 다음 API들을 검색하여 **Enable**:
   - **Google Drive API**
   - **Google+ API** (또는 People API)

### Step 3: OAuth 2.0 클라이언트 ID 생성
1. **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type**: Web application
4. **Name**: Nice Notes Web Client
5. **Authorized JavaScript origins**:
   ```
   http://localhost:5173
   http://localhost:3000
   ```
6. **Authorized redirect URIs**:
   ```
   http://localhost:5173/auth/callback
   http://localhost:3000/auth/callback
   ```
7. **Create** 클릭
8. **Client ID**와 **Client Secret** 복사

## 2. 환경 변수 설정

`.env.local` 파일 업데이트:
```env
# Google OAuth 2.0 Configuration (실제 값으로 교체)
VITE_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret_here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_GOOGLE_SCOPE=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile
```

## 3. 테스트 절차

### 개발 서버 시작:
```bash
npm run dev
```

### OAuth 플로우 테스트:
1. 브라우저에서 `http://localhost:5173` 접속
2. 헤더의 **"Sign in with Google"** 버튼 클릭
3. Google 로그인 화면에서 계정 선택
4. 권한 승인 (Drive 파일 접근)
5. 자동으로 앱으로 리다이렉트
6. 헤더에 사용자 정보 표시 확인

## 4. 구현된 주요 기능

### OAuth 인증:
- `GoogleDriveService.startAuthFlow()`: 인증 시작
- `GoogleDriveService.exchangeCodeForToken()`: 토큰 교환
- `GoogleDriveService.getUserInfo()`: 사용자 정보 조회
- `GoogleDriveService.signOut()`: 로그아웃

### Drive API 메서드:
- `createFile()`: 파일 생성/업데이트
- `createFolder()`: 폴더 생성
- `listFiles()`: 파일/폴더 목록
- `deleteFile()`: 파일/폴더 삭제
- `getFileContent()`: 파일 내용 읽기
- `searchMemoFiles()`: 메모 파일 검색

### UI 컴포넌트:
- `GoogleAuthButton`: 로그인/로그아웃 버튼
- `OAuthCallback`: OAuth 콜백 처리
- 헤더에 Google 인증 상태 표시

## 5. 다음 단계 (추가 개발)

### Drive와 로컬 메모 동기화:
```typescript
// 예시: 메모를 Google Drive에 자동 저장
const syncMemoToDrive = async (memo: Memo) => {
  const driveService = GoogleDriveService.getInstance();
  if (driveService.isAuthenticated()) {
    await driveService.createFile(
      `${memo.title}.txt`,
      memo.content,
      'text/plain'
    );
  }
};
```

### 오프라인 지원:
- 로컬 스토리지와 Drive 동기화
- 충돌 해결 메커니즘
- 자동 백업 스케줄링

### 폴더 구조 동기화:
- 로컬 폴더를 Drive 폴더로 매핑
- 중첩 폴더 구조 유지
- 권한 및 공유 설정

## 6. 보안 고려사항

1. **토큰 보안**: Access token은 메모리에만 저장 (localStorage 사용 주의)
2. **HTTPS 사용**: 프로덕션에서는 반드시 HTTPS 사용
3. **스코프 최소화**: 필요한 권한만 요청
4. **토큰 갱신**: Refresh token으로 자동 갱신 구현

## 7. 문제 해결

### 일반적인 오류:
- **"origin_mismatch"**: Authorized origins 확인
- **"redirect_uri_mismatch"**: Redirect URIs 확인
- **"invalid_client"**: Client ID/Secret 확인
- **"insufficient_scope"**: API 활성화 및 스코프 확인

### 디버깅:
```javascript
// 브라우저 콘솔에서 인증 상태 확인
const service = GoogleDriveService.getInstance();
console.log('Authenticated:', service.isAuthenticated());
```

## 8. 프로덕션 배포 시

1. **도메인 업데이트**: Google Cloud Console에서 실제 도메인 추가
2. **환경 변수**: 프로덕션 환경에 맞게 업데이트
3. **CORS 설정**: 필요시 CORS 정책 확인
4. **SSL 인증서**: HTTPS 필수

---

## 현재 상태
- ✅ Google OAuth 2.0 서비스 구현 완료
- ✅ Drive API 메서드 구현 완료
- ✅ UI 컴포넌트 통합 완료
- ⏳ Google Cloud Console 설정 필요
- ⏳ 실제 OAuth 플로우 테스트 필요

**다음 작업**: Google Cloud Console에서 OAuth 클라이언트 ID 생성 후 `.env.local` 파일 업데이트
