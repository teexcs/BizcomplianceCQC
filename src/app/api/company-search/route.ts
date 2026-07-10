import { NextRequest, NextResponse } from 'next/server';

type CompaniesHouseItem = {
  title?: string;
  company_number?: string;
  address_snippet?: string;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ results: [] });
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const response = await fetch(
    `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=6`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return NextResponse.json({ results: [] });
  }

  const data = (await response.json()) as { items?: CompaniesHouseItem[] };
  const results = (data.items ?? [])
    .map((item) => ({
      name: item.title?.trim() ?? '',
      companyNumber: item.company_number,
      description: item.address_snippet,
    }))
    .filter((item) => item.name)
    .slice(0, 6);

  return NextResponse.json({ results });
}
