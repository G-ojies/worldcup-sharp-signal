import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreYat SharpSignal — autonomous steam-move agent",
  description:
    "Autonomous, proof-grounded sharp-money detector for the 2026 World Cup, powered by the TxLINE StablePrice feed and verified on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
