"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await signIn("credentials", { password, redirect: false });
    if (result?.ok) {
      router.push("/");
    } else {
      setError("Contraseña incorrecta");
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-green-400 text-center">Coach Financiero IA</h1>
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
        />
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
