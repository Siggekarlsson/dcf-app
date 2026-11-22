import { companyData } from "@/lib/data";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await companyData.search(q.slice(0, 64));
  return Response.json({ results });
}
