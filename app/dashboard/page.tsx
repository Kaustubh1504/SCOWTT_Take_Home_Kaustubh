import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FactDisplay from "./FactDisplay";
import Image from "next/image";
import { IoLogOutOutline } from "react-icons/io5";
import { BiCameraMovie } from "react-icons/bi";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
    },
  });

  if (!user?.favoriteMovie) {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-gray-900 to-gray-800 p-8">
      <div className="max-w-2xl mx-auto">
        {/* User Info Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={64}
                height={64}
                className="rounded-full"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-2xl text-white">
                  {user.name?.[0] || user.email?.[0] || "?"}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {user.name || "User"}
              </h1>
              <p className="text-gray-400">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 flex items-center gap-3">
            <BiCameraMovie className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-gray-400 text-sm">Favorite Movie</p>
              <p className="text-xl text-white font-semibold">
                {user.favoriteMovie}
              </p>
            </div>
          </div>
        </div>

        {/* Fact Display */}
        <FactDisplay movie={user.favoriteMovie} />

        {/* Logout Button */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <IoLogOutOutline className="w-5 h-5" />
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}