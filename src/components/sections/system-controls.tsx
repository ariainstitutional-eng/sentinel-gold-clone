"use client";

import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import React, { useCallback, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

const LovableIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M6 0L7.14554 4.85446L12 6L7.14554 7.14554L6 12L4.85446 7.14554L0 6L4.85446 4.85446L6 0Z"
      fill="#7DFBC3"
    />
  </svg>
);

const SystemControls = () => {
  const [busy, setBusy] = useState<boolean>(false);

  const handleToggleAI = useCallback(async (active: boolean) => {
    try {
      setBusy(true);
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: { aiActive: active },
      });
      toast.success(active ? "AI System Activated" : "AI System Deactivated");
    } catch (error) {
      toast.error("Failed to toggle AI system");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleEmergencyStop = useCallback(async () => {
    try {
      setBusy(true);
      await apiFetch("/api/system/toggle", {
        method: "POST",
        body: { aiActive: false, riskMonitorActive: false },
      });
      toast.success("Emergency Stop Activated - All systems halted");
    } catch (error) {
      toast.error("Failed to activate emergency stop");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleConnectMT5 = useCallback(async () => {
    try {
      setBusy(true);
      await apiFetch("/api/accounts", {
        method: "POST",
        body: {
          broker: "FBS",
          server: "FBS-Demo",
          login: "103936248",
          alias: "MT5 Demo",
          balance: 0,
          equity: 0,
          status: "connected",
        },
      });
      toast.success("MT5 Account Connected Successfully");
    } catch (error) {
      toast.error("Failed to connect MT5 account");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-foreground">
          System Controls
        </h3>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={handleConnectMT5} disabled={busy}>
            <Zap className="h-4 w-4" />
            Connect MT5
          </Button>
          <Button className="gap-2" onClick={() => handleToggleAI(true)} disabled={busy}>
            <Zap className="h-4 w-4" />
            Activate AI
          </Button>
          <Button
            variant="outline"
            className="gap-2 hover:bg-accent hover:text-accent-foreground"
            onClick={handleEmergencyStop}
            disabled={busy}
          >
            <Zap className="h-4 w-4 text-destructive" />
            Emergency Stop
          </Button>
        </div>
      </div>
      <a
        href="https://lovable.dev/projects/cd0eeab3-f1b2-4b33-8b13-1963448ab2c6?utm_source=lovable-badge"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-2.5 right-2.5 z-50 flex w-[141px] items-center justify-center gap-1.5 rounded-[5px] bg-black px-2 py-[5px] text-xs font-semibold text-white/80 no-underline shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-colors hover:text-white"
      >
        Edit with
        <LovableIcon className="h-3 w-3" />
        Lovable
      </a>
    </>
  );
};

export default SystemControls;