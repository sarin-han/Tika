import { eq, min } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tickets } from "@/server/db/schema";
import { TICKET_STATUS, TICKET_PRIORITY } from "@/shared/types";
import type { CreateTicketInput } from "@/shared/types";

export const create = async (input: CreateTicketInput) => {
  const [{ minPosition }] = await db
    .select({ minPosition: min(tickets.position) })
    .from(tickets)
    .where(eq(tickets.status, TICKET_STATUS.BACKLOG));

  const position = minPosition === null ? 1024 : minPosition - 1024;

  const [created] = await db
    .insert(tickets)
    .values({
      title: input.title,
      description: input.description ?? null,
      status: TICKET_STATUS.BACKLOG,
      priority: input.priority ?? TICKET_PRIORITY.MEDIUM,
      position,
      plannedStartDate: input.plannedStartDate ?? null,
      dueDate: input.dueDate ?? null,
    })
    .returning();

  return created;
};
