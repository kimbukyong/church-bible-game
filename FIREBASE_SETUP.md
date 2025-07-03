# 🔥 Firebase 설정 가이드

성경 말씀 게임을 Firebase와 연동하여 **실시간 동기화**를 활성화하는 방법입니다.

## 📋 1단계: Firebase 프로젝트 생성

### 1. Firebase Console 접속
- [Firebase Console](https://console.firebase.google.com/) 방문
- **pyedu60@gmail.com** 계정으로 로그인

### 2. 새 프로젝트 생성
1. **"프로젝트 추가"** 클릭
2. 프로젝트 이름: `bible-verse-game` (또는 원하는 이름)
3. Google Analytics 설정 (선택사항)
4. **"프로젝트 만들기"** 클릭

## 🗄️ 2단계: Realtime Database 설정

### 1. 데이터베이스 생성
1. 왼쪽 메뉴에서 **"Realtime Database"** 클릭
2. **"데이터베이스 만들기"** 클릭
3. 위치 선택: `asia-southeast1` (싱가포르) 권장
4. 보안 규칙: **"테스트 모드에서 시작"** 선택 (임시)

### 2. 보안 규칙 설정
```json
{
  "rules": {
    "churches": {
      "$churchName": {
        ".read": true,
        ".write": true,
        "admin_password": {
          ".read": false
        }
      }
    }
  }
}
```

## 🌐 3단계: 웹 앱 설정

### 1. 웹 앱 추가
1. 프로젝트 개요에서 **웹 아이콘 `</>`** 클릭
2. 앱 닉네임: `bible-game-web`
3. Firebase Hosting 설정 체크 (선택사항)
4. **"앱 등록"** 클릭

### 2. 설정 복사
Firebase SDK 설정 화면에서 `firebaseConfig` 객체를 복사하세요:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBdVl-cGaQOFH...",
  authDomain: "bible-verse-game.firebaseapp.com",
  databaseURL: "https://bible-verse-game-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "bible-verse-game",
  storageBucket: "bible-verse-game.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## ⚙️ 4단계: 코드에 설정 적용

### 1. firebase-config.js 파일 수정
`firebase-config.js` 파일에서 다음 부분을 찾아 교체하세요:

```javascript
// 🔽 이 부분을 교체하세요
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",           // ← 실제 API 키
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/",
    projectId: "YOUR_PROJECT_ID",         // ← 실제 프로젝트 ID
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",  // ← 실제 메시징 센더 ID
    appId: "YOUR_APP_ID"                  // ← 실제 앱 ID
};
```

### 2. 설정 확인
브라우저 개발자 도구 콘솔에서 다음 메시지 확인:
- ✅ `Firebase 연결 성공!`
- 🔥 `Firebase 실시간 동기화 활성화됨`

## 🚀 5단계: 무료 배포

### GitHub + Netlify 배포 (권장)

#### 1. GitHub 레포지토리 생성
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bible-verse-game.git
git push -u origin main
```

#### 2. Netlify 배포
1. [Netlify](https://netlify.com) 접속
2. **"New site from Git"** 클릭
3. GitHub 연결 및 레포지토리 선택
4. 배포 설정:
   - Build command: (비워둠)
   - Publish directory: (비워둠)
5. **"Deploy site"** 클릭

### 대안: Vercel 배포
1. [Vercel](https://vercel.com) 접속
2. **"Import Project"** 클릭
3. GitHub 레포지토리 선택
4. 자동 배포 완료

### 대안: Firebase Hosting 배포
```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# 프로젝트 초기화
firebase init hosting

# 배포
firebase deploy
```

## 🔧 트러블슈팅

### 문제 1: Firebase 연결 실패
**증상**: 콘솔에 "Firebase 연결 실패" 메시지
**해결**:
1. `firebase-config.js`의 설정 값 재확인
2. 네트워크 연결 확인
3. 브라우저 개발자 도구에서 오류 메시지 확인

### 문제 2: 데이터 저장 안됨
**증상**: 말씀이나 점수가 저장되지 않음
**해결**:
1. Realtime Database 보안 규칙 확인
2. 브라우저 개발자 도구 Network 탭에서 Firebase 요청 확인
3. Firebase Console에서 데이터베이스 활성화 상태 확인

### 문제 3: CORS 오류
**증상**: "CORS policy" 오류 메시지
**해결**:
1. HTTPS로 접속 (HTTP 아님)
2. Firebase 도메인 설정 확인
3. 로컬 개발 시 `http://localhost` 사용

## 📊 데이터베이스 구조

Firebase Realtime Database의 데이터 구조:

```json
{
  "churches": {
    "온누리교회": {
      "admin_password": "hashed_password",
      "createdAt": 1699123456789,
      "verses": {
        "verse_id_1": {
          "id": "verse_id_1",
          "reference": "요한복음 3:16",
          "text": "하나님이 세상을 이처럼 사랑하사...",
          "createdAt": 1699123456789
        }
      },
      "students": {
        "김철수": {
          "name": "김철수",
          "scores": {
            "verse_id_1": {
              "level1": 85,
              "level2": 92,
              "level3": 78,
              "completed": true
            }
          },
          "totalScore": 255,
          "gamesPlayed": 3,
          "lastPlayed": 1699123456789
        }
      },
      "rankings": {
        "김철수": {
          "name": "김철수",
          "totalScore": 255,
          "gamesPlayed": 3,
          "averageScore": 85.0,
          "lastPlayed": 1699123456789
        }
      }
    }
  }
}
```

## 🎯 완료 확인

모든 설정이 완료되면:
1. 🔥 **실시간 동기화** 상태 표시기가 보임
2. **A 휴대폰**에서 말씀 등록 → **B 휴대폰**에서 즉시 확인 가능
3. 점수와 랭킹이 실시간으로 동기화됨

## 💡 추가 팁

### 보안 강화
- 실제 서비스 시 Realtime Database 보안 규칙 강화
- 관리자 비밀번호 해싱 적용
- Firebase Authentication 연동 고려

### 성능 최적화
- 데이터베이스 인덱싱 설정
- 캐싱 전략 적용
- 이미지/음성 파일은 Firebase Storage 사용

### 모니터링
- Firebase Analytics 설정
- 사용량 모니터링
- 오류 추적 설정

---

**문제가 있다면** 이 파일과 함께 오류 메시지를 공유해주세요! 🙏 