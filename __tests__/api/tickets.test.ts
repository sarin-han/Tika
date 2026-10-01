/**
 * @jest-environment node
 */
import { POST } from "../../app/api/tickets/route";

const toDateString = (date: Date): string => date.toISOString().split("T")[0];

const futureDueDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return toDateString(date);
};

const pastDueDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return toDateString(date);
};

const createRequest = (body: unknown): Request =>
  new Request("http://localhost/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/tickets - TC-API-001", () => {
  // 001-2: 전체 필드로 생성
  it("모든 필드를 포함하여 생성하면 201과 입력한 값을 그대로 반환한다", async () => {
    const input = {
      title: "API 설계 문서 작성",
      description: "REST API 엔드포인트와 요청/응답 형식을 정의한다",
      priority: "HIGH",
      plannedStartDate: toDateString(new Date()),
      dueDate: futureDueDate(),
    };

    const response = await POST(createRequest(input));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: input.title,
      description: input.description,
      status: "BACKLOG",
      priority: "HIGH",
      position: expect.any(Number),
      plannedStartDate: input.plannedStartDate,
      dueDate: input.dueDate,
      startedAt: null,
      completedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  // 001-1, 001-11: 필수 필드만으로 생성
  it("제목만으로 생성하면 201과 함께 priority 기본값 MEDIUM이 적용된다", async () => {
    const response = await POST(createRequest({ title: "테스트 할일" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: "테스트 할일",
      description: null,
      status: "BACKLOG",
      priority: "MEDIUM",
      position: expect.any(Number),
      plannedStartDate: null,
      dueDate: null,
      startedAt: null,
      completedAt: null,
    });
  });

  // 001-3: 제목 누락
  it("제목이 없으면 400과 함께 제목을 입력해주세요 에러를 반환한다", async () => {
    const response = await POST(createRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "제목을 입력해주세요",
      },
    });
  });

  // 001-6: 제목 200자 초과
  it("제목이 200자를 초과하면 400과 함께 길이 제한 에러를 반환한다", async () => {
    const response = await POST(
      createRequest({ title: "a".repeat(201) })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "제목은 200자 이내로 입력해주세요",
      },
    });
  });

  // 001-9: 과거 종료예정일
  it("종료예정일이 과거이면 400과 함께 날짜 유효성 에러를 반환한다", async () => {
    const response = await POST(
      createRequest({ title: "ok", dueDate: pastDueDate() })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "종료예정일은 오늘 이후 날짜를 선택해주세요",
      },
    });
  });

  // 001-8: 잘못된 우선순위
  it("잘못된 우선순위 값을 보내면 400과 함께 우선순위 에러를 반환한다", async () => {
    const response = await POST(
      createRequest({ title: "ok", priority: "URGENT" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요",
      },
    });
  });
});
