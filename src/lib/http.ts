import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/authz";

export function handle<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse | Response>,
) {
  return async (...args: T): Promise<NextResponse | Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid request", issues: err.flatten().fieldErrors },
          { status: 422 },
        );
      }
      console.error("Unhandled route error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
