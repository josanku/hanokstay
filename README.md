# Hanokstay by Wehome

영문 한옥스테이 랜딩 + 한국어 한옥 정보 + 통계·지도 대시보드 + 한옥마을·명품고택 전용 페이지.

## 페이지 구성

```
hanokstay/
├── index.html              ← 영문 메인 랜딩 (Sleep Inside Korea)
├── map.html                ← 지도·통계 대시보드 (Kakao Map + Charts)
├── villages.html           ← 한옥마을 20곳 안내
├── meongpum-gotaek.html    ← 명품고택 (KTO 인증 최고 등급) — 별도 페이지
├── hanok-intro.html        ← 한국어 한옥 종합 소개 (10챕터)
├── styles.css              ← 디자인 시스템 (먹·한지·단청)
├── script.js               ← 메인 페이지 인터랙션
│
├── content/                ← 영문 한옥 콘텐츠
│   ├── hanok-guide-en.html      Hanok 101 종합 가이드
│   ├── architecture-en.html     건축 상세
│   ├── regions-en.md            지역 클러스터
│   └── glossary-en.md           80+ 한·영 용어집
│
├── data/                   ← JSON 시드 데이터 (실데이터로 교체 예정)
│   ├── hanokstay.json           한옥체험업 리스팅 + 시도/평면형/연도별 통계
│   ├── villages.json            한옥마을 20곳
│   └── meongpum-gotaek.json     명품고택 20곳
│
├── js/                     ← JavaScript
│   └── map.js                   카카오맵 + 필터 + 차트
│
├── scripts/                ← 데이터 수집
│   └── fetch_localdata.py       data.go.kr LOCALDATA OpenAPI 호출 스크립트
│
└── docs/                   ← 전략 문서
    ├── db-integration.md        레거시 한옥 DB → 위홈 통합
    └── kto-partnership.md       KTO 협력 전략
```

## 로컬 실행

```bash
# 정적 서버 권장 (fetch() 사용으로 file:// 에서 일부 작동 안함)
cd /Users/skyblue/hanokstay && python3 -m http.server 8080
# http://localhost:8080 접속
```

## 카카오맵 활성화

1. https://developers.kakao.com → 애플리케이션 생성
2. **JavaScript 키** 발급, **플랫폼 등록 → Web 사이트 도메인** 추가
3. [map.html](map.html) 의 다음 라인 교체:
   ```html
   window.KAKAO_JS_KEY = "YOUR_KAKAO_JS_KEY";
   ```
   에 발급받은 키 입력.
4. 키가 없으면 자동으로 표 형태 fallback이 표시됩니다 (지도 영역에 한옥 목록 Top 30).

## 실데이터 연결 (LOCALDATA / data.go.kr)

1. https://www.data.go.kr 회원가입
2. "지방행정인허가 - 한옥체험업" 검색 → OpenAPI 활용신청
3. 발급된 serviceKey 환경변수 설정:
   ```bash
   export DATA_GO_KR_KEY="발급키"
   python3 scripts/fetch_localdata.py --out data/hanokstay.json
   ```
4. 자동으로 시드 데이터를 덮어쓰고, 차트·지도가 실데이터 기반으로 갱신됩니다.

## 명품고택 데이터 업데이트

매년 5월 KTO 명품고택 인증 명단이 갱신됩니다. 공식 명단:
- 한국관광공사 한옥홍보 홈페이지: `hanok.visitkorea.or.kr`
- 갱신 후 [data/meongpum-gotaek.json](data/meongpum-gotaek.json) 수동 업데이트.

## 두 종류의 사용자 (페이지가 답하는 질문)

| 사용자 | 무엇이 보이는가 |
|--------|----------------|
| **한옥에 묵으려는 여행자** | 지도·필터·명품고택·한옥마을·한옥 소개. "어디로 갈까"의 답 |
| **한옥스테이 현황을 보려는 사람** (호스트 후보·연구자·KTO·언론) | 통계·차트·시도별 분포·성장 추이. "지금 한옥스테이는 어떤가"의 답 |

지도 페이지 상단의 토글로 두 모드를 전환합니다.

## 다음 액션

1. **카카오맵 키 설정** — JavaScript 키 발급 후 [map.html](map.html) 에 주입
2. **data.go.kr API 키 발급** — 실데이터 자동 갱신
3. **호스트 사진 입수** — 현재는 그라디언트 placeholder. 실 사진 30장 입수 후 교체
4. **AI 큐레이터 검색 백엔드** — 현재 stub. 위홈 AI에 연결
5. **명품고택 공식 명단 정합성 확인** — KTO 공식 명단과 대조 (시드는 공개정보 기반)
