import { fetchInvoicesPages } from "@/app/lib/data";
import Pagination from "./pagination";

export default async function PaginationWrapper(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const totalPages = await fetchInvoicesPages(searchParams?.query || "");
  // NOTE: Uncomment this code in Chapter 11

  return <Pagination searchParams={searchParams} totalPages={totalPages} />;
}
