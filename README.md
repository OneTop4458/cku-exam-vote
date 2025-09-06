
# 📊 시험 시간 투표 시스템 구축 가이드

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-green.svg)](https://pages.github.com/)

## 시스템 개요

### 아키텍처
```
사용자 브라우저
    ↓ (HTTPS)
GitHub Pages (index.html, admin.html)
    ↓ (AJAX/Fetch)
Google Apps Script (웹 앱)
    ↓ (API 호출)
Google Sheets (데이터 저장)
```

**데이터 흐름**:
1. 사용자가 투표 페이지 접속 (GitHub Pages)
2. 투표 데이터 전송 (AJAX → Google Apps Script)
3. 데이터 검증 및 저장 (Apps Script → Google Sheets)
4. 결과 표시 (실시간 동기화)

## 🎯 주요 기능

### 👤 사용자 기능
- 🎓 소속 선택 (드롭다운 + 직접 입력)
- ⏰ 시간 선택 (관리자가 설정한 옵션)
- ✅ 모든 시간 가능 옵션
- 🔒 개인정보 자동 마스킹 (성명/학번)
- 📊 실시간 투표 현황 확인

### 👨‍💼 관리자 기능
- 🔑 관리자 인증 (비밀번호)
- ⚙️ 동적 설정 변경 (제목/설명/시간 옵션)
- 🕐 시간 옵션 커스터마이징 (이모지/라벨/설명)
- 🏫 대학 목록 커스터마이징 (추가/삭제/수정)
- 📅 투표 기간 설정
- 📈 대시보드 및 통계
- 📥 CSV 데이터 내보내기

## 준비사항

### 필수 계정
- **Google 계정**: Sheets와 Apps Script 사용
- **GitHub 계정**: 코드 호스팅과 Pages 사용

### 환경
- 최신 브라우저 (Chrome 권장)
- 인터넷 연결

---

## 구축 가이드

### 1단계: Google Sheets 준비
1. [sheets.google.com](https://sheets.google.com) 접속
2. 새 스프레드시트 생성
3. 시트 이름을 `votes`로 변경
4. 공유 설정: "링크가 있는 모든 사용자"

📖 [Google Sheets 도움말](https://support.google.com/sheets)

### 2단계: Google Apps Script 설정
1. 스프레드시트에서 **확장 프로그램** → **Apps Script** 클릭
2. `Code.gs` 파일 내용 전체 복사해서 붙여넣기
3. **저장** 클릭
4. **배포** → **새 배포** → **웹 앱** 선택
5. 실행 사용자: 자신, 접근: 모든 사용자
6. **배포** 후 URL 복사 (https://script.google.com/macros/s/.../exec)

📖 [Apps Script 시작하기](https://developers.google.com/apps-script/overview)

### 3단계: GitHub Pages 설정
1. [github.com](https://github.com)에서 새 저장소 생성 (Public)
2. `index.html`, `admin.html`, `README.md` 파일 업로드
3. `index.html` 편집해서 GAS_URL을 2단계 URL로 교체
4. 저장소 Settings → Pages → Source: main 브랜치 선택
5. 표시된 GitHub Pages URL 확인

📖 [GitHub Pages 시작하기](https://pages.github.com/)

### 4단계: 테스트
1. GitHub Pages URL 접속해서 투표 테스트
2. Google Sheets에 데이터가 저장되는지 확인
3. admin.html로 관리자 기능 테스트

## 🔧 관리

### 👨‍💼 관리자 페이지
```
https://your-username.github.io/repo-name/admin.html
```

### 🔑 관리자 키 설정
- Apps Script → 프로젝트 설정 → 스크립트 속성
- 속성: `ADMIN_PW`, 값: 복잡한 비밀번호

📖 [Apps Script 속성 관리](https://developers.google.com/apps-script/guides/properties)

### 📊 데이터 관리
- CSV 내보내기: URL에 `?format=csv&apiKey=키` 추가
- 데이터 초기화: 관리자 페이지에서 가능
- 설정 변경: 관리자 페이지에서 실시간 변경

## ❓ 문제 해결

### 🚨 일반적인 오류
- **서버 연결 실패**: GAS_URL 확인, Apps Script 재배포
- **관리자 로그인 실패**: ADMIN_API_KEY 확인
- **데이터 저장 안됨**: 스프레드시트 공유 설정 확인
- **페이지 로드 안됨**: GitHub Pages 설정 확인

### 🔍 디버깅
- 브라우저 F12 → Console 탭에서 오류 확인
- Apps Script 실행 로그 확인

📖 [Apps Script 디버깅](https://developers.google.com/apps-script/guides/logging)

## 🎨 커스터마이징

### ⚙️ 기본 설정 변경
- 대학 목록: 관리자 페이지에서 실시간 추가/삭제/수정
- 시간 옵션: 관리자 페이지에서 실시간 변경
- 투표 제목/설명: 관리자 페이지에서 텍스트 수정
- 디자인 색상: CSS 스타일 수정

### 🔄 동적 프로퍼티 키 시스템
- 시간 옵션 ID 기반 자동 프로퍼티 키 생성
- 예: 시간 옵션 ID가 '9'이면 `UNAVAILABLE_9` 키 자동 생성
- 새로운 시간 옵션 추가 시 자동으로 키 매핑

---

## 📄 라이선스

MIT License
