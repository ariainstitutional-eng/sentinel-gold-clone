"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  Brain, 
  LineChart, 
  Shield, 
  Activity,
  Settings
} from "lucide-react";
import { TradingTab } from "./tabs/trading-tab";
import { RiskManagementTab } from "./tabs/risk-management-tab";
import { PerformanceTab } from "./tabs/performance-tab";
import { AITrainingTab } from "./tabs/ai-training-tab";
import { MarketIntelligenceTab } from "./tabs/market-intelligence-tab";
import { SystemControlTab } from "./tabs/system-control-tab";

export default function TradingDashboard() {
  return (
    <div className="w-full">
      <Tabs defaultValue="trading" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-card/50 backdrop-blur-sm border border-border">
          <TabsTrigger 
            value="trading" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <LineChart className="h-4 w-4" />
            <span className="hidden sm:inline">Trading</span>
          </TabsTrigger>
          <TabsTrigger 
            value="risk" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Risk</span>
          </TabsTrigger>
          <TabsTrigger 
            value="performance" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger 
            value="ai" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Training</span>
          </TabsTrigger>
          <TabsTrigger 
            value="market" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Market Intel</span>
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-3"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="trading" className="m-0">
            <TradingTab />
          </TabsContent>
          
          <TabsContent value="risk" className="m-0">
            <RiskManagementTab />
          </TabsContent>
          
          <TabsContent value="performance" className="m-0">
            <PerformanceTab />
          </TabsContent>
          
          <TabsContent value="ai" className="m-0">
            <AITrainingTab />
          </TabsContent>
          
          <TabsContent value="market" className="m-0">
            <MarketIntelligenceTab />
          </TabsContent>
          
          <TabsContent value="system" className="m-0">
            <SystemControlTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}