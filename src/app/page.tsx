import Header from "@/components/sections/header";
import TradingDashboard from "@/components/sections/trading-dashboard";

export default function Page() {
  return (
    <div className="min-h-screen bg-background-primary p-4 space-y-4">
      <Header />
      <TradingDashboard />
    </div>
  );
}