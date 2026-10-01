import { createTicketSchema } from "@/shared/validations/ticket";
import { create } from "@/server/services/ticketService";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0].message,
        },
      },
      { status: 400 }
    );
  }

  const ticket = await create(parsed.data);

  return Response.json(ticket, { status: 201 });
}
