import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Check if already onboarded
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteMovie: true },
  });

  if (user?.favoriteMovie) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-gray-900 to-gray-800">
      <div className="bg-gray-800 p-8 rounded-xl shadow-xl max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome!</h1>
        <p className="text-gray-400 mb-6">
          Tell us your favorite movie to get started
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}