"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { DemoEndpoint, AgentConfig, FlowStep, TransactionLogEntry } from "@/lib/types";
import { demoEndpoints } from "@/lib/demo-endpoints";
import { tourSteps } from "@/lib/tour-steps";
import { AgentConfigPanel } from "@/components/agent-config";
import { EndpointPicker } from "@/components/endpoint-picker";
import { FlowVisualizer } from "@/components/flow-visualizer";
import { ResponsePanel } from "@/components/response-panel";
import { SpendTracker } from "@/components/spend-tracker";
import { GuidedTour } from "@/components/guided-tour";
import { executeRequest } from "./actions";

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function randomBase58(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return result;
}

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const autoTour = searchParams.get("tour") === "1";

  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    walletAddress: "",
    chain: "solana-devnet",
    maxPerTransaction: "0.10",
    maxPerDay: "1.00",
    status: "active",
    smartAccountPda: "",
    onChainLimit: "",
  });
  const [selectedEndpoint, setSelectedEndpoint] = useState<DemoEndpoint | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [response, setResponse] = useState<unknown>(null);
  const [cost, setCost] = useState<string | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionSpend, setSessionSpend] = useState(0);
  const [transactionLog, setTransactionLog] = useState<TransactionLogEntry[]>([]);

  // Tour state
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourWaiting, setTourWaiting] = useState(false);

  const isLive = false;
  const animationRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const initRef = useRef(false);

  // Auto-generate wallet on first visit
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setAgentConfig((prev) => ({
      ...prev,
      walletAddress: randomBase58(44),
    }));
    if (autoTour) {
      // Small delay to let DOM render before starting tour
      setTimeout(() => setTourActive(true), 400);
    }
  }, [autoTour]);

  const handleExecute = useCallback(async () => {
    if (!selectedEndpoint || !agentConfig.walletAddress) return;

    setIsExecuting(true);
    setFlowSteps([]);
    setResponse(null);
    setCost(null);
    setTotalTime(null);

    animationRef.current.forEach(clearTimeout);
    animationRef.current = [];

    try {
      const result = await executeRequest(selectedEndpoint, agentConfig, sessionSpend);

      let cumulativeDelay = 0;
      result.steps.forEach((step, index) => {
        const stepDelay = step.delay ?? 200;
        cumulativeDelay += stepDelay;

        const activeTimer = setTimeout(() => {
          setFlowSteps((prev) => [
            ...prev.slice(0, index),
            { ...step, status: "active" as const },
          ]);
        }, cumulativeDelay);
        animationRef.current.push(activeTimer);

        const duration = step.duration ?? 200;
        cumulativeDelay += duration;
        const completeTimer = setTimeout(() => {
          setFlowSteps((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, status: step.status } : s
            )
          );
        }, cumulativeDelay);
        animationRef.current.push(completeTimer);
      });

      const finalTimer = setTimeout(() => {
        setIsExecuting(false);

        if (result.response) {
          setResponse(result.response);
          setCost(result.cost);

          const totalMs = result.steps.reduce((sum, s) => sum + (s.duration ?? 0), 0);
          setTotalTime(totalMs);

          const newSpend = parseFloat(result.totalSpent);
          setSessionSpend(newSpend);

          // Decrement on-chain limit for successful payments
          if (agentConfig.smartAccountPda && !result.errorCode) {
            const currentOnChain = parseFloat(agentConfig.onChainLimit) || 0;
            const pricePaid = parseFloat(result.cost) || 0;
            const newOnChain = Math.max(0, currentOnChain - pricePaid);
            setAgentConfig((prev) => ({
              ...prev,
              onChainLimit: newOnChain.toFixed(3),
            }));
          }

          setTransactionLog((prev) => [
            ...prev,
            {
              endpoint: selectedEndpoint.path,
              cost: result.cost,
              txHash: result.txHash ?? "N/A",
              timestamp: Date.now(),
            },
          ]);
        }
      }, cumulativeDelay + 100);
      animationRef.current.push(finalTimer);
    } catch {
      setIsExecuting(false);
    }
  }, [selectedEndpoint, agentConfig, sessionSpend]);

  // Tour action dispatcher
  const dispatchTourAction = useCallback(
    (action: string) => {
      switch (action) {
        case "generate-wallet":
          setAgentConfig((prev) => ({
            ...prev,
            walletAddress: prev.walletAddress || randomBase58(44),
          }));
          break;
        case "select-weather": {
          const weather = demoEndpoints.find((ep) => ep.path === "/api/weather");
          if (weather) setSelectedEndpoint(weather);
          break;
        }
        case "select-premium": {
          const premium = demoEndpoints.find((ep) => ep.path === "/api/premium-analytics");
          if (premium) setSelectedEndpoint(premium);
          break;
        }
        case "send-request":
          // Trigger execute — the handleExecute will run on next tick
          setTimeout(() => {
            handleExecute();
          }, 300);
          break;
      }
    },
    [handleExecute],
  );

  // Handle tour step changes — dispatch auto-actions
  const handleTourNext = useCallback(() => {
    const nextIdx = tourStep + 1;
    if (nextIdx >= tourSteps.length) {
      setTourActive(false);
      setTourStep(0);
      return;
    }
    setTourStep(nextIdx);

    const next = tourSteps[nextIdx];
    if (next.autoAction) {
      setTourWaiting(true);
      dispatchTourAction(next.autoAction);
      setTimeout(() => {
        setTourWaiting(false);
      }, next.actionDelay ?? 2000);
    }
  }, [tourStep, dispatchTourAction]);

  const handleTourPrev = useCallback(() => {
    setTourStep((s) => Math.max(0, s - 1));
  }, []);

  const handleTourExit = useCallback(() => {
    setTourActive(false);
    setTourStep(0);
    setTourWaiting(false);
  }, []);

  const startTour = useCallback(() => {
    setTourStep(0);
    setTourActive(true);
  }, []);

  const hasSmartAccount = agentConfig.smartAccountPda.length > 0;
  const onChainLimit = hasSmartAccount ? parseFloat(agentConfig.onChainLimit) || 0 : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div data-tour="playground-header" className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Agent Playground</h1>
          <p className="text-sm text-text-muted">
            Simulate how an AI agent interacts with paid API endpoints using the x402 protocol
          </p>
        </div>
        <button
          onClick={startTour}
          className="flex items-center gap-2 rounded-lg border border-border-bright px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Guided Demo
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left column — Config + Spend */}
        <div className="space-y-4 lg:col-span-3">
          <AgentConfigPanel
            config={agentConfig}
            onChange={setAgentConfig}
            isLive={isLive}
          />
          <SpendTracker
            totalSpent={sessionSpend}
            maxPerDay={parseFloat(agentConfig.maxPerDay) || 1}
            transactions={transactionLog}
            onChainEnabled={hasSmartAccount}
            onChainLimit={onChainLimit}
          />
        </div>

        {/* Center column — Endpoints + Response */}
        <div className="space-y-4 lg:col-span-5">
          <EndpointPicker
            endpoints={demoEndpoints}
            selected={selectedEndpoint}
            onSelect={setSelectedEndpoint}
            onExecute={handleExecute}
            isExecuting={isExecuting}
          />
          <ResponsePanel
            response={response}
            cost={cost}
            totalTime={totalTime}
          />
        </div>

        {/* Right column — Flow Visualizer */}
        <div className="lg:col-span-4">
          <FlowVisualizer
            steps={flowSteps}
            transactionLog={transactionLog}
          />
        </div>
      </div>

      {/* Tour overlay */}
      {tourActive && (
        <GuidedTour
          steps={tourSteps}
          currentStep={tourStep}
          onNext={handleTourNext}
          onPrev={handleTourPrev}
          onExit={handleTourExit}
          isWaiting={tourWaiting}
        />
      )}
    </main>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense>
      <PlaygroundInner />
    </Suspense>
  );
}
