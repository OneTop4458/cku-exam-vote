
# 시험 시간 투표 (GitHub Pages + Google Apps Script)
- 프런트: GitHub Pages (정적)
- 백엔드: Google Apps Script 웹앱(스프레드시트)
- 민감값(API Key 등)은 **Script Properties**에 저장. 공개 레포/Pages에도 안전.

## 기능
- 소속대학 버튼 + '기타(직접입력)'
- 순번 서버 자동 부여
- 입력값 검증(성명/학번/선택 필수)
- 재투표 방지(동일 학번 거부)
- 표/집계/CSV(일반: 학번 마스킹, 관리자: 원본)

## 배포 절차
1) **GAS 백엔드**
   - 스프레드시트 생성 → 시트명 `votes`
   - Apps Script에서 `Code.gs` 붙여넣기 → 저장
   - (선택) 프로젝트 설정 → 스크립트 속성
     - `ADMIN_API_KEY` = 임의의 길고 복잡한 값 (관리자 작업/원본 CSV 용)
   - 배포 → *새로운 배포* → 유형: **웹 앱**, 접근: **모든 사용자** → 배포 → `/exec` URL 복사

2) **프런트**
   - `index.html` 상단의 `GAS_URL`에 복사한 웹앱 URL 붙여넣기
   - GitHub에 커밋/푸시 → Pages 활성화

3) **관리자 CSV / 초기화(선택)**
   - 원본 학번 CSV: `GET {WEBAPP_URL}?format=csv&apiKey=관리자키`
   - 전체 삭제: 
     ```bash
     curl -X POST "{WEBAPP_URL}" \
       -H "Content-Type: application/json" \
       -d '{"action":"clear","apiKey":"<ADMIN_API_KEY>"}'
     ```

## 운영 팁
- 일반 조회/CSV는 학번이 마스킹됨.
- 스팸 방지 필요 시 reCAPTCHA v3 추가(서버 검증은 스크립트 속성에 시크릿 보관).
- 대학 목록/시간대는 `index.html`의 `UNIVS`/체크박스만 수정하면 됨.

_빌드: 2025-09-06T07:59:21.964183_
