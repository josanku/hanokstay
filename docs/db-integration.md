# Hanokstay DB Integration Plan

## 핵심 원칙

**위홈 메인 DB와 한옥스테이는 같은 호스트·예약 데이터를 공유한다. 분리하지 않는다.**

이유: 호스트 1명이 한옥과 비-한옥 자산을 동시에 보유할 수 있고, 예약/정산/세금 관점에서도 단일 데이터가 진실의 원천이어야 함. 한옥스테이는 **UI·도메인 분리 + 데이터 통합**.

---

## 데이터 모델 (확장 부분)

기존 위홈 `listings` 테이블에 한옥 전용 필드 추가:

```sql
-- 한옥 전용 확장 필드 (listings 테이블)
hanok_certified            BOOLEAN     DEFAULT FALSE  -- Wehome 한옥 인증 여부
hanok_license_type         ENUM('hanok_experience', 'foreign_urban_bnb', 'rural_bnb', 'cultural_property')
hanok_license_number       VARCHAR(64)                -- 한옥체험업 등록번호
hanok_license_issuer       VARCHAR(128)               -- 발급 지자체
hanok_license_verified_at  TIMESTAMP                  -- 위홈이 직접 확인한 시점

-- 건축 특성
hanok_shape                ENUM('il', 'giyeok', 'nieun', 'digeut', 'mieum', 'h', 'other')
hanok_roof_type            ENUM('giwa', 'choga', 'neowa', 'mixed')
hanok_year_built           INTEGER                    -- 건축 연도 (추정 가능)
hanok_renovated_at         INTEGER                    -- 리노베이션 연도
hanok_floor_count          INTEGER                    -- 보통 1, 일부 2
hanok_has_madang           BOOLEAN                    -- 마당 보유
hanok_has_ondol            BOOLEAN                    -- 온돌 (거의 항상 TRUE)
hanok_has_maru             BOOLEAN                    -- 마루
hanok_has_sadang           BOOLEAN                    -- 사당 (희귀)
hanok_has_jangdokdae       BOOLEAN                    -- 장독대

-- 문화재 등급
cultural_property_status   ENUM('none', 'registered', 'designated', 'national_treasure')
cultural_property_number   VARCHAR(64)

-- 게스트 경험
hanok_experiences          JSON  -- ['tea_ceremony', 'hanbok_rental', 'kimchi_making', 'calligraphy', ...]
hanok_languages_spoken     JSON  -- ['ko', 'en', 'ja', 'zh']
hanok_host_on_site         BOOLEAN

-- 위치 가치
nearest_palace_km          DECIMAL
nearest_unesco_km          DECIMAL
village_cluster            VARCHAR(64)  -- 'bukchon', 'jeonju', 'hahoe', ...

-- 콘텐츠 (다국어)
hanok_story_ko             TEXT          -- 한옥지기가 들려주는 이 집의 이야기
hanok_story_en             TEXT
hanok_story_ja             TEXT
hanok_story_zh             TEXT
```

기존 호스트 테이블 확장:

```sql
-- hosts 테이블에 추가
is_hanok_keeper            BOOLEAN     DEFAULT FALSE
hanok_keeper_generation    INTEGER                    -- 몇 대째 한옥지기인지
hanok_keeper_since         DATE                       -- 한옥 운영 시작
languages_for_guests       JSON                       -- ['ko', 'en', ...]
guest_communication_pref   ENUM('phone', 'kakao', 'whatsapp', 'wehome_ai_proxy')
```

---

## 기존 한옥스테이 DB 인계 단계

### 1단계 — 데이터 추출 (1주차)

기존 한옥스테이 DB에서 다음 필드 우선 추출:
- 호스트 식별자 (이메일·전화번호·실명)
- 리스팅명·주소·건물 사진
- 마지막 활동일 (예약·로그인·리스팅 수정)
- 과거 운영 상태 (활성/휴면/이탈)
- 보유 자격증·등록증 사본

산출물: `hanok_legacy_hosts.csv` (분류 라벨 포함 — A/B/C 세그먼트)

### 2단계 — 매칭 (2주차)

위홈 메인 DB와의 매칭:
- 이메일·전화번호로 1차 매칭
- 같은 사람이 위홈에 이미 호스트로 등록되어 있다면 → `is_hanok_keeper = TRUE` 플래그만 추가
- 매칭 안 되는 신규 → 위홈 호스트 계정 자동 생성 + 복귀 초대장 발송

### 3단계 — 콘텐츠 보강 (2~3주차)

레거시 DB의 한옥 리스팅 사진·설명을 위홈 한옥스테이 형식으로 마이그레이션:
- 건축 특성 자동 추론 (AI 비전 — 사진에서 ㄱ자/ㅁ자/기와/초가 등 식별)
- 영문 스토리 1차 초안 자동 번역 → 호스트 검수
- 위치 가치(palace/UNESCO 근접도) 자동 계산

### 4단계 — 검증 (4주차)

- 한옥체험업 등록번호 → 문체부 공개 데이터 대조 (자동화 가능)
- 등록증 사본 → 위홈 큐레이터가 1건씩 확인
- 검증 통과한 호스트만 한옥스테이 페이지에 노출

---

## API 분리 전략

- **공통 백엔드**: 위홈 메인 API (예약·결제·정산·메시지)
- **한옥 전용 API 엔드포인트**:
  - `GET /api/hanoks` — 한옥 리스팅만 (필터: shape, region, license_type, experiences)
  - `GET /api/hanoks/curate` — AI 큐레이터 자연어 검색
  - `GET /api/hanok-hosts/:id/story` — 한옥지기 스토리 (다국어)
  - `GET /api/hanok-clusters` — 지역 클러스터 메타데이터
- **공용 엔드포인트** (위홈 메인과 동일):
  - 예약·결제·게스트 메시지·후기

요지: 데이터는 같고, 한옥 도메인에는 "한옥 필터가 걸린 뷰"만 제공.

---

## 도메인·라우팅

권고:
- `hanokstay.wehome.me` (서브도메인) 또는 `wehome.me/hanok` (서브패스)
- SEO 측면에서 **서브도메인 권고** — 영문 한옥 콘텐츠의 도메인 권위를 별도로 쌓을 수 있음
- 단, 호스트 가입·예약은 위홈 메인 도메인으로 리다이렉트 (계정·결제 통합 유지)

---

## 데이터 거버넌스 체크리스트

- [ ] 레거시 한옥스테이 호스트 동의 재취득 (개인정보보호법)
- [ ] 휴면 호스트 정보 보존 기간 점검
- [ ] 한옥체험업 등록번호 공개 범위 (지자체별 다를 수 있음)
- [ ] 문화재 지정 한옥의 외부 노출 제약 확인 (문화재청 협의)
- [ ] 영문 스토리에서 호스트 개인 식별 정보 마스킹
