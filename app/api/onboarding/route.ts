import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const movie = sanitizeInput(body.movie || "");

    // Server-side validation
    if (!movie) {
      return NextResponse.json(
        { error: "Movie is required" },
        { status: 400 }
      );
    }

    if (movie.length < 1 || movie.length > 200) {
      return NextResponse.json(
        { error: "Movie must be between 1 and 200 characters" },
        { status: 400 }
      );
    }

    // Update user with favorite movie
    await prisma.user.update({
      where: { id: session.user.id },
      data: { favoriteMovie: movie },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}