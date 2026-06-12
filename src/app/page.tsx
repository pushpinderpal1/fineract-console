"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/fineract";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const s = getSession();
    router.replace(s?.authenticated ? "/loan-products" : "/login");
  }, [router]);
  return null;
}
