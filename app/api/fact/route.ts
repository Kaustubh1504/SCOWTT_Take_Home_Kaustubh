import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { Prisma } from "@/generated/prisma/client";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CACHE_WINDOW_SECONDS = 60;

type TransactionResult = {
  action: "RETURN_CACHED" | "RETURN_FALLBACK" | "RETURN_WAIT" | "GENERATE";
  payload?: {
    fact?: string | null;
    cached?: boolean;
    message?: string;
    error?: string;
  };
  status?: number;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteMovie: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.favoriteMovie) {
      return NextResponse.json(
        { error: "No favorite movie set" },
        { status: 400 }
      );
    }

    const movie = user.favoriteMovie;
    const cacheThreshold = new Date(Date.now() - CACHE_WINDOW_SECONDS * 1000);

    let factRecord: { id: string } | null = null;
    let transactionResult: TransactionResult | null = null;

    try {
      transactionResult = await prisma.$transaction(
        async (tx): Promise<TransactionResult> => {
          const cachedFact = await tx.fact.findFirst({
            where: {
              userId,
              movie,
              status: "COMPLETED",
              createdAt: { gte: cacheThreshold },
            },
            orderBy: { createdAt: "desc" },
          });

          if (cachedFact) {
            return { action: "RETURN_CACHED", payload: { fact: cachedFact.content, cached: true } };
          }
          const pendingFact = await tx.fact.findFirst({
            where: {
              userId,
              movie,
              status: "PENDING",
              createdAt: { gte: cacheThreshold },
            },
          });

          if (pendingFact) {
            const lastGoodFact = await getLastSuccessfulFact(userId, movie);
            if (lastGoodFact) {
              return {
                action: "RETURN_FALLBACK",
                payload: {
                  fact: lastGoodFact.content,
                  cached: true,
                  message: "Generation in progress, returning cached fact",
                },
              };
            }
            return {
              action: "RETURN_WAIT",
              payload: { error: "Fact generation in progress, please wait" },
              status: 202,
            };
          }
          factRecord = await tx.fact.create({
            data: {
              userId,
              movie,
              status: "PENDING",
            },
          });

          return { action: "GENERATE" };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (txError: any) {
      if (txError.code === "P2034") {
        const lastGoodFact = await getLastSuccessfulFact(userId, movie);
        if (lastGoodFact) {
          return NextResponse.json({
            fact: lastGoodFact.content,
            cached: true,
            message: "Generation in progress, returning cached fact",
          });
        }
        return NextResponse.json(
          { error: "Fact generation in progress, please wait" },
          { status: 202 }
        );
      }
      throw txError;
    }

    if (!transactionResult || transactionResult.action !== "GENERATE") {
      return NextResponse.json(
        transactionResult?.payload || { error: "Unknown state" },
        { status: transactionResult?.status || 200 }
      );
    }

    if (!factRecord) {
      throw new Error("Failed to acquire database lock.");
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a movie expert. Provide a single interesting, fun, and lesser-known fact about the movie the user mentions. Keep it concise (2-3 sentences max).",
          },
          {
            role: "user",
            content: `Tell me a fun fact about the movie "${movie}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      });

      const factContent =
        completion.choices[0]?.message?.content || "No fact generated";
      await prisma.fact.update({
        where: { id: factRecord.id },
        data: {
          content: factContent,
          status: "COMPLETED",
        },
      });

      return NextResponse.json({ fact: factContent, cached: false });
    } catch (openaiError) {
      console.error("OpenAI error:", openaiError);

      await prisma.fact.update({
        where: { id: factRecord.id },
        data: { status: "FAILED" },
      });

      const lastGoodFact = await getLastSuccessfulFact(userId, movie);
      if (lastGoodFact) {
        return NextResponse.json({
          fact: lastGoodFact.content,
          cached: true,
          message: "Using cached fact due to generation error",
        });
      }

      return NextResponse.json(
        { error: "Failed to generate fact. Please try again later." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Fact API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function getLastSuccessfulFact(userId: string, movie: string) {
  return prisma.fact.findFirst({
    where: {
      userId,
      movie,
      status: "COMPLETED",
    },
    orderBy: { createdAt: "desc" },
  });
}