const WINDOW_MS = 60 * 1000; 
const MAX_REQUESTS = 10;

const requests = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userRequests = requests.get(userId);

  if (!userRequests || now > userRequests.resetTime) {
    requests.set(userId, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (userRequests.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userRequests.count++;
  return { allowed: true, remaining: MAX_REQUESTS - userRequests.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of requests.entries()) {
    if (now > data.resetTime) {
      requests.delete(userId);
    }
  }
}, 60 * 1000); // Clean up every minute