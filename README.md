# Movie Memory

Movie Memory is a full-stack Next.js application that leverages OpenAI to provide users with fun, lesser-known facts about their favorite movies. This project was built as part of a technical take-home exercise.

# Live Deployed Link: https://movie-memory-lovat.vercel.app/

# Video Demo Link: https://drive.google.com/file/d/1xW9-xBBQypE1dZ1WTAeWyQEB0O4A0Cah/view?usp=sharing

##  Setup Instructions

### 1\. Prerequisites

  * Node.js (v18 or later)
  * PostgreSQL database
  * Google OAuth credentials (via Google Cloud Console)
  * OpenAI API Key

### 2\. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database (Supabase)
DATABASE_URL="postgresql://user:password@host:5432/database"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# OpenAI
OPENAI_API_KEY="sk-your-key"
```

### 3\. Installation & Database Setup

```bash
npm install

npx prisma migrate dev

npx prisma generate
```

### 4\. Running the App

```bash
npm run dev
```

Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) to view the application.

-----

##  Architecture Overview

The application is built using the **Next.js 15 App Router** and **Prisma ORM**.

### Data Modeling
<img src="/public/datamodel.png" alt="Alt text" width="500"/>

The schema is modularized into multiple files under `prisma/schema/` for better maintainability:

  * **`User`**: Stores core profile data and the `favoriteMovie` preference.
  * **`Fact`**: Stores generated trivia with a `FactStatus` enum (`PENDING`, `COMPLETED`, `FAILED`) to track the lifecycle of an AI request.
  * **`Account/Session`**: Standard Auth.js models for Google OAuth integration.

### Backend Logic (Variant A Implementation)
<img src="/public/movie_fact_api_flow.svg" alt="Alt text" width="500" />

I chose **Variant A (Backend-Focused)** to demonstrate high-level consistency and concurrency control.

  * **60-Second Cache Window**: The system checks for existing `COMPLETED` facts for the specific user and movie within the last 60 seconds before triggering a new AI call.
  * **Burst Protection (Concurrency)**: To prevent multiple simultaneous OpenAI calls (e.g., from multiple tabs), the API uses a **Prisma transaction with `Serializable` isolation**. It creates a `PENDING` record as a "lock." If another request arrives while a fact is `PENDING`, the system returns a `202 Accepted` status or a previous cached fact.
  * **Failure Handling**: If the OpenAI API fails, the backend automatically scavenges the most recent successful fact from history to ensure the user still sees content.
  * **Minimal Backend Tests** : A Vitest suite was implemented to enforce these guarantees . The tests verify that:
    1. Unauthenticated users are blocked with a 401 status.
    2. Data isolation is maintained by strictly querying via the authenticated user's ID.
    3. The 60-second cache window is respected, bypassing OpenAI for recent records.
    4. A database "lock" (PENDING status) is correctly created before any external API calls are made.
-----


##  Key Tradeoffs

1.  **Transaction Isolation Level**: I used `Serializable` isolation for the locking mechanism. While this ensures the highest level of correctness against race conditions, it can lead to serialization failures under extremely high write loads. I mitigated this by catching `P2034` errors and providing a fallback response.
2.  **Server Actions vs. Route Handlers**: I used Server Actions for simple mutations like Sign Out but kept the Fact Generation in a standard Route Handler to allow the client-side `useEffect` and "Refresh" button to fetch data easily using standard browser `fetch`.

-----

##  If I Had 2 More Hours...

1.  **In-Memory Caching (Redis)**: For high-scale production, I would move the "Generation Lock" from the database to Redis to reduce DB load and latency.
2.  **Comprehensive Testing**: I would implement integration tests using Playwright to verify the end-to-end onboarding flow and Vitest for mocking the OpenAI failure states.
3.  **Search/Autocomplete**: I would add a movie search API (like TMDB) to the onboarding flow to ensure movie titles are standardized, which would make caching much more effective.

-----

## AI Usage Disclosure

  * **Boilerplate Generation**: Used AI to scaffold the initial NextAuth configuration and Tailwind UI components for the Dashboard.
  * **Logic Refinement**: Used AI to help debug the Prisma `Serializable` transaction logic to ensure the race-condition protection was robust.
  * **Documentation**: Used AI to help structure this README based on the project requirements.

## Additional References & Resources

### Architecture & Concurrency
* [Prisma Serializable Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#serializable) - Technical basis for the burst protection logic.
* [Supabase Connection Management](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler) - Rationale for using Transaction Pooling (Port 6543) in serverless environments.

### Security & Authentication
* [Auth.js (v5) Documentation](https://authjs.dev/reference/nextjs) - Reference for the Next.js App Router authentication flow.
* [Google OAuth Scopes & Redirects](https://developers.google.com/identity/protocols/oauth2) - Standard for secure callback URI configuration.

### Tooling
* [Vitest](https://vitest.dev/) - Used for backend unit testing of the cache and authorization logic.
* [Repomix](https://github.com/kakaue/repomix) - Used to bundle the repository for AI-assisted review and analysis.
