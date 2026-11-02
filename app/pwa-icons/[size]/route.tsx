import { appIcon } from "@/lib/app-icon";

/** Home-screen icons for the manifest; "512-maskable" leaves Android room to cut it to its own shape. */
const SIZES = ["192", "512", "512-maskable"];

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa-icons/[size]">) {
  const { size } = await params;
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return appIcon(Number.parseInt(size, 10), { maskable: size.endsWith("-maskable") });
}
