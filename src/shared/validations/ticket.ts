import { z } from "zod";
import { TICKET_PRIORITY } from "@/shared/types";

export const createTicketSchema = z.object({
  title: z
    .string({ message: "제목을 입력해주세요" })
    .min(1, "제목을 입력해주세요")
    .max(200, "제목은 200자 이내로 입력해주세요")
    .refine((val) => val.trim().length > 0, "제목을 입력해주세요"),
  description: z.string().max(1000, "설명은 1000자 이내로 입력해주세요").optional(),
  priority: z
    .enum([TICKET_PRIORITY.LOW, TICKET_PRIORITY.MEDIUM, TICKET_PRIORITY.HIGH], {
      message: "우선순위는 LOW, MEDIUM, HIGH 중 선택해주세요",
    })
    .optional(),
  plannedStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (val) => val >= new Date().toISOString().split("T")[0],
      "종료예정일은 오늘 이후 날짜를 선택해주세요"
    )
    .optional(),
});
