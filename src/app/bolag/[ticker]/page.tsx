import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ValuationView } from "@/components/valuation/ValuationView";
import { companyData } from "@/lib/data";

export async function generateStaticParams() {
  return (await companyData.listTickers()).map((ticker) => ({ ticker }));
}

export async function generateMetadata(props: PageProps<"/bolag/[ticker]">): Promise<Metadata> {
  const { ticker } = await props.params;
  const company = await companyData.getCompany(decodeURIComponent(ticker));
  return { title: company ? `${company.name} — DCF` : "Bolaget hittades inte" };
}

export default async function CompanyPage(props: PageProps<"/bolag/[ticker]">) {
  const { ticker } = await props.params;
  const company = await companyData.getCompany(decodeURIComponent(ticker));
  if (!company) notFound();
  return <ValuationView key={company.ticker} company={company} />;
}
