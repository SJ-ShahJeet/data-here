import type { Metadata } from "next";
import "./v2.css";

export const metadata: Metadata = {
  title: "Memory Graph — Dashboard v2",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
