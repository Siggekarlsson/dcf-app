import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-neutral-500">Sidan eller bolaget hittades inte.</p>
      <Link href="/" className="mt-4 text-sm text-accent">
        Till sökningen
      </Link>
    </main>
  );
}
