import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Hoist all mocks so they initialize before imports
const {
  mockAuthFn,
  mockUserFindUnique,
  mockFactFindFirst,
  mockFactCreate,
  mockFactUpdate,
  mockOpenAICreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockAuthFn: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockFactFindFirst: vi.fn(),
  mockFactCreate: vi.fn(),
  mockFactUpdate: vi.fn(),
  mockOpenAICreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

// 2. Mock external dependencies
vi.mock("@/lib/auth", () => ({
  auth: mockAuthFn,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        fact: {
          findFirst: mockFactFindFirst,
          create: mockFactCreate, 
        },
      };
      return callback(tx);
    }),
    user: {
      findUnique: mockUserFindUnique,
    },
    fact: {
      findFirst: mockFactFindFirst,
      update: mockFactUpdate,
      create: mockFactCreate, 
    },
  },
}));

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        chat: {
          completions: {
            create: mockOpenAICreate,
          },
        },
      };
    }),
  };
});

// Import the actual route AFTER mocking
import { GET } from "@/app/api/fact/route";

describe("Fact API - Core Requirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Requirement: Authorization & Data Isolation", () => {
    it("1. should return 401 if user is not authenticated", async () => {
      mockAuthFn.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("2. should strictly query the database using the authenticated user's ID", async () => {
      const secureUserId = "user-123";
      mockAuthFn.mockResolvedValue({ user: { id: secureUserId } });
      mockUserFindUnique.mockResolvedValue({ favoriteMovie: "Inception" });
      mockFactFindFirst.mockResolvedValue(null);

      await GET();

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: secureUserId },
        select: { favoriteMovie: true },
      });
    });
  });

  describe("Requirement: 60-Second Cache Logic", () => {
    it("3. should return cached fact and bypass OpenAI if less than 60 seconds old", async () => {
      mockAuthFn.mockResolvedValue({ user: { id: "user-123" } });
      mockUserFindUnique.mockResolvedValue({ favoriteMovie: "Inception" });

      mockFactFindFirst.mockResolvedValue({
        id: "fact-1",
        content: "Cached fact about Inception",
        status: "COMPLETED",
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fact).toBe("Cached fact about Inception");
      expect(data.cached).toBe(true);
      expect(mockOpenAICreate).not.toHaveBeenCalled(); 
    });

    it("4. should generate new fact, create lock, and call OpenAI if cache is older than 60 seconds", async () => {
      mockAuthFn.mockResolvedValue({ user: { id: "user-123" } });
      mockUserFindUnique.mockResolvedValue({ favoriteMovie: "Inception" });
      
      // Simulate cache miss
      mockFactFindFirst.mockResolvedValue(null);
      mockFactCreate.mockResolvedValue({ id: "new-lock-1" });
      
      // Simulate OpenAI response
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: "Brand new fact!" } }],
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fact).toBe("Brand new fact!");
      expect(data.cached).toBe(false);
      expect(mockFactCreate).toHaveBeenCalled(); // Verifies PENDING lock creation
      expect(mockOpenAICreate).toHaveBeenCalledOnce();
    });
  });
});