import { SearchBox } from "@/components/SearchBox";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-6">
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center pb-[18vh]">
        <h1 className="mb-2 text-center text-2xl font-medium tracking-tight text-neutral-900">
          Vad är bolaget värt?
        </h1>
        <p className="mb-10 text-center text-neutral-500">
          DCF-värdering som du justerar med vanligt språk.
        </p>
        <SearchBox autoFocus />
      </div>
      <footer className="pb-8 text-center text-xs text-neutral-400">
        Mockdata för demo. Inte investeringsråd.
      </footer>
    </main>
  );
}
