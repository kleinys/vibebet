import { redirect } from "next/navigation";

export default async function PaperDuelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/games/duels");
}
