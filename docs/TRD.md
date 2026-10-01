# TRD - Tika (기술 요구사항 명세)

> 본 문서는 `PRD.md`의 기능 목록(FR-001~FR-008)과 기술 스택 요약표를 기술적으로 구체화한다. `CLAUDE.md`의 프로젝트 구조·코딩 컨벤션·경계 규칙을 그대로 따른다.

## 1. 시스템 아키텍처

### 1.1 전체 구조

Tika는 **Vercel 단일 배포**로 구성한다. 프론트엔드(Next.js 페이지/컴포넌트)와 백엔드(Route Handler)가 하나의 Next.js 앱에 공존하며, 별도의 백엔드 서버 없이 Vercel Serverless Functions 위에서 API가 실행된다. DB는 Vercel Postgres(Neon)를 사용한다.

```
┌─────────────────────────────── Vercel ───────────────────────────────┐
│                                                                        │
│  ┌───────────────────┐        ┌───────────────────────────────────┐  │
│  │ Next.js App Router │        │   Vercel Serverless Functions      │  │
│  │  (Frontend, RSC)   │        │   (app/api/* Route Handlers)       │  │
│  └────────┬───────────┘        └──────────────┬────────────────────┘  │
│           │                                    │                       │
└───────────┼────────────────────────────────────┼───────────────────────┘
            │                                    │
            ▼                                    ▼
     사용자 브라우저                     Vercel Postgres (Neon)
```

### 1.2 아키텍처 다이어그램 (요청 흐름)

```
[Frontend: src/client/]
   컴포넌트 (React)
        │  호출
        ▼
   ticketApi.ts (fetch 래퍼)
        │  HTTP 요청
        ▼
[app/api/]
   Route Handler  ── 요청 파싱 (Zod 검증) ──┐
        │                                    │
        ▼                                    │
[src/server/services/]                       │
   ticketService  ── 비즈니스 로직 ──────────┘
        │
        ▼
[src/server/db/]
   Drizzle ORM (schema, query)
        │
        ▼
   Vercel Postgres (Neon)
```

흐름 요약: **프런트엔드 → Route Handler → Service → Drizzle → DB**, 응답은 역순으로 반환된다. Route Handler는 파싱/응답만 담당하고, 실질 로직은 Service 계층에 위치한다(`CLAUDE.md` 백엔드 컨벤션).

### 1.3 디렉터리 구조

```
app/
  api/
    tickets/
      route.ts          # GET(목록)/POST(생성) - 요청 파싱 + 서비스 호출 + 응답
      [id]/route.ts      # GET(단건)/PATCH(수정)/DELETE(삭제)

src/
  server/
    services/
      ticketService.ts   # 비즈니스 로직 (CRUD, 상태 전이, position 재계산)
    db/
      schema.ts          # Drizzle 스키마 정의
      client.ts          # DB 커넥션
    middleware/
      errorHandler.ts    # 에러 응답 포맷 통일

  client/
    components/
      Board.tsx
      Column.tsx
      TicketCard.tsx
      BacklogSidebar.tsx
    hooks/
      useTickets.ts
      useDragAndDrop.ts
    api/
      ticketApi.ts       # 프런트가 API를 호출하는 유일한 창구

  shared/
    types/
      ticket.ts          # Tikect, BoardData 등 공유 타입
    validations/
      ticketSchema.ts    # Zod 스키마 (프런트/백엔드 공통)
    constants/
      status.ts          # 컬럼 상태 const 객체 (enum 대신)

docs/
  PRD.md / TRD.md / REQUIREMENTS.md / API_SPEC.md / DATA_MODEL.md / COMPONENT_SPEC.md / TEST_CASES.md
```

## 2. 기술 스택 상세

| 영역 | 기술 | 버전 | 선정 이유 | 대안 비교 |
|---|---|---|---|---|
| Framework | Next.js | 15 (App Router) | 프론트/백엔드를 한 저장소에서 관리하면서도 `app/api/` ↔ `src/client/` 디렉토리 분리 구조를 지원. Vercel과 네이티브 통합 | Remix: Vercel Postgres/서버리스 통합 사례가 상대적으로 적음. 별도 Express 서버: 배포 구성이 이원화되어 MVP 속도 저하 |
| 런타임 | Node.js | Vercel Serverless Functions (Node.js 런타임) | 별도 서버 운영 없이 Route Handler가 곧 API 서버 역할을 함, 오토스케일링 | Edge Runtime: Drizzle의 Postgres 드라이버·커넥션 방식과의 호환성 이슈로 MVP 단계에서는 제외 |
| Language | TypeScript | strict 모드 | `any` 금지, `src/shared/types` 기반 프론트-백엔드 타입 계약을 컴파일 타임에 보장 | JavaScript: 타입 안전성 부재로 공유 스키마 검증 비용 증가 |
| Frontend | React | 19 | 함수 컴포넌트 + 훅 기반 개발, Next.js 15 App Router의 기본 렌더링 모델과 호환 | Vue/Svelte: Next.js App Router 생태계와의 직접 통합 부재 |
| Styling | Tailwind CSS | 4 | 유틸리티 클래스로 칸반 보드의 컬럼/카드 레이아웃을 빠르게 구현, 별도 디자인 시스템 없이 일관된 스타일 유지 | CSS Modules: 반복되는 카드/컬럼 스타일에 대해 클래스 관리 비용 증가 |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable | 최신 안정 버전 | 접근성(a11y)을 고려한 드래그 앤 드롭, 컬럼 간 카드 이동에 필요한 sortable 컨텍스트 제공, React 19 호환 | react-beautiful-dnd: 유지보수 중단, React 19 미지원 |
| ORM | Drizzle ORM | 최신 안정 버전 | Vercel Postgres 공식 지원, 스키마가 곧 타입이 되어 별도 코드 생성(generate) 없이 타입 안전 쿼리 작성 가능, 경량 런타임 | Prisma: 스키마 변경 시 `prisma generate` 코드 생성 단계가 추가로 필요하고 런타임이 무거움. Drizzle은 SQL에 가까운 쿼리 빌더로 서버리스 콜드스타트에 유리 |
| DB | Vercel Postgres (Neon) | - | 서버리스 환경에 맞는 커넥션 풀 자동 관리(Neon Pooler), Vercel 배포와 통합된 환경 변수 주입 | 자체 관리 PostgreSQL(RDS 등): 커넥션 풀링을 직접 구성해야 하며 서버리스 콜드스타트 시 커넥션 고갈 위험 |
| Validation | Zod | 최신 안정 버전 | `src/shared/validations`에 정의한 스키마를 프론트(폼 검증)와 백엔드(요청 검증)에서 동일하게 재사용 | Yup/Joi: TypeScript 타입 추론(`z.infer`) 통합이 Zod만큼 매끄럽지 않음 |
| Testing | Jest + React Testing Library | 최신 안정 버전 | 컴포넌트/서비스 단위 테스트, TDD(Red-Green-Refactor) 사이클 지원 | Vitest: Next.js 공식 예제와의 설정 성숙도 차이로 MVP 단계에서는 Jest 채택 |
| Deployment | Vercel | - | Next.js와 네이티브 통합, Postgres(Neon)와 동일 플랫폼에서 배포·환경 변수 관리 일원화 | 별도 IaaS(AWS 등): 배포 파이프라인/환경 변수 관리 이원화로 MVP 단계에 과함 |

## 3. 데이터 흐름

### 3.1 읽기 흐름

```
컴포넌트 (Board.tsx 등)
   → src/client/api/ticketApi.ts  (fetch GET)
   → GET /api/tickets              (app/api/tickets/route.ts)
   → ticketService.getTickets()    (src/server/services)
   → Drizzle 쿼리
   → Vercel Postgres
   ← 응답 (JSON) 역순 반환
```

### 3.2 쓰기 흐름

```
폼 입력 (TicketCard/상세 폼)
   → Zod 스키마로 클라이언트 측 검증 (src/shared/validations)
   → src/client/api/ticketApi.ts   (fetch POST/PATCH)
   → POST/PATCH /api/tickets(/:id) (app/api/tickets/route.ts)
   → Zod 스키마로 서버 측 재검증 (동일 스키마 재사용)
   → ticketService.createTicket() / updateTicket()
   → Drizzle 쿼리
   → Vercel Postgres
```

클라이언트 검증과 서버 검증은 `src/shared/validations`의 동일한 Zod 스키마를 사용해 이중 관리 비용을 없앤다.

### 3.3 드래그 앤 드롭 흐름

```
1. 사용자가 카드를 드래그하여 다른 컬럼/위치에 드롭
2. 프런트: 낙관적 업데이트(Optimistic Update)로 UI 상태 즉시 반영
      (useDragAndDrop 훅에서 로컬 상태의 status/position 즉시 변경)
3. PATCH /api/tickets/:id  { status, position }
4. ticketService.moveTicket()
      - status 변경 시 시작일/종료일 자동 기록 (FR-007)
      - 같은 컬럼 내 형제 티켓들의 position 재계산
5. 응답 성공 → 낙관적 상태 확정
   응답 실패 → 이전 상태로 롤백 + 에러 표시
```

## 4. 계층 간 경계 규칙

- `src/server/` ↔ `src/client/` **상호 import 금지**. 백엔드 로직에서 React 관련 코드를 작성하지 않고, 프론트엔드에서 Drizzle/DB에 직접 접근하지 않는다.
- `src/shared/`만 양쪽에서 참조 가능하다. 타입/Zod 스키마/상수는 반드시 `src/shared/`에 정의하고 양쪽에서 import한다.
- Route Handler(`app/api/`)는 얇게 유지한다: **요청 파싱 → 서비스 호출 → 응답 반환** 외의 로직(쿼리, 상태 전이 계산 등)을 두지 않는다.
- 비즈니스 로직은 전부 `src/server/services/`에 위치한다.
- 에러 응답 포맷은 `{ error: { code, message } }`로 통일하며 `src/server/middleware/errorHandler.ts`에서 일괄 처리한다.
- 프런트엔드의 API 호출은 `src/client/api/ticketApi.ts`를 통해서만 이뤄진다(컴포넌트가 fetch를 직접 호출하지 않는다).

## 5. 개발 환경 설정

1. **의존성 설치**: `npm install` (Next.js 15 / React 19 / Drizzle / dnd-kit / Zod 등)
2. **로컬 DB 환경 변수**: Vercel 프로젝트와 연결 후 `vercel env pull .env.local`로 Vercel Postgres(Neon) 접속 정보를 가져온다.
3. **DB 스키마 반영**: Drizzle Kit으로 `src/server/db/schema.ts` 기준 마이그레이션 생성 및 적용.
4. **개발 서버 실행**: `next dev`
5. **테스트**: Jest + React Testing Library. `npm test`로 서비스(단위)/컴포넌트(RTL) 테스트 실행. TDD 사이클(Red → Green → Refactor)에 따라 `TEST_CASES.md`의 케이스를 먼저 작성한다.
6. **Lint/Format**: ESLint + Prettier. 커밋 전 `npm run lint`로 `any` 사용, `console.log` 잔존 여부 등을 점검한다.

## 6. 배포 전략

- **Production 배포**: `main` 브랜치에 push되면 Vercel이 자동으로 프로덕션 배포를 수행한다.
- **Preview 배포**: PR 생성 시 Vercel이 해당 브랜치 기준 Preview 배포를 자동 생성하여 리뷰 시 실제 동작을 확인할 수 있다.
- **환경 변수 관리**: DB 접속 정보 등 민감 정보는 코드에 커밋하지 않고 Vercel Dashboard(Project Settings → Environment Variables)에서 관리하며, 로컬 개발 시 `vercel env pull`로 동기화한다.

## 7. PRD 정합성 확인

- **기능 목록**: 본 문서 3장(데이터 흐름)의 CRUD·드래그 앤 드롭·자동 일정 기록 흐름은 `PRD.md`의 FR-001(생성)~FR-008(완료 확인)을 모두 기술적으로 커버한다. 특히 FR-005(드래그 앤 드롭)와 FR-007(일정 자동 기록)은 3.3절의 낙관적 업데이트 흐름에서 함께 구현된다.
- **기술 스택 요약표**: 본 문서 2장의 스택 목록(Next.js 15, React 19, TypeScript strict, Tailwind CSS 4, @dnd-kit, Drizzle ORM, Vercel Postgres(Neon), Zod, Jest+RTL, Vercel)은 `PRD.md` 6장 기술 스택 표와 항목·선정 이유가 일치한다. TRD에서는 여기에 버전 표기와 Drizzle vs Prisma 등 대안 비교를 추가로 명시했다.
- **경계 규칙**: `CLAUDE.md`의 "경계 규칙"(백엔드/프론트엔드 상호 수정 금지, `src/shared/` 우선 수정)과 본 문서 4장의 계층 간 경계 규칙이 동일하다.

