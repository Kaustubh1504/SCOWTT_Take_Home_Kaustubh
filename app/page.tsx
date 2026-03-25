import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { prisma } from "@/lib/prisma";

export default async function LandingPage() {
  const session = await auth();
  
  if (session?.user?.email) { 
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }, 
      select: { favoriteMovie: true },
    });

    if (user?.favoriteMovie) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  const handleGoogleSignIn = async () => {
    "use server";
    await signIn("google");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-gray-900 to-gray-800">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold text-white">Movie Memory</h1>
        <p className="text-xl text-gray-300">
          Discover fun facts about your favorite movies
        </p>

        <form action={handleGoogleSignIn}>
          <button
            type="submit"
            className="px-8 py-4 bg-white text-gray-900 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors flex items-center gap-3 mx-auto"
          >
            <FcGoogle className="w-6 h-6" />
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}