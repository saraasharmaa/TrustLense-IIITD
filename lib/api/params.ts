import { z } from "zod";
import { AppError } from "@/lib/errors";

// Route params are untrusted; anything that isn't a uuid cannot be a case
export async function requireCaseId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw new AppError("not_found", "Case not found");
  return id;
}
