"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TourStep, TooltipPosition } from "@/lib/tour-steps";

interface GuidedTourProps {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  isWaiting: boolean; // true while an auto-action is in flight
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // spotlight padding around target
const TOOLTIP_W = 340;
const TOOLTIP_GAP = 16;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function computeTooltipStyle(
  targetRect: Rect,
  position: TooltipPosition,
  tooltipHeight: number,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (position) {
    case "bottom":
      top = targetRect.top + targetRect.height + PAD + TOOLTIP_GAP;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
      break;
    case "top":
      top = targetRect.top - PAD - TOOLTIP_GAP - tooltipHeight;
      left = targetRect.left + targetRect.width / 2 - TOOLTIP_W / 2;
      break;
    case "right":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left + targetRect.width + PAD + TOOLTIP_GAP;
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.left - PAD - TOOLTIP_GAP - TOOLTIP_W;
      break;
  }

  // Clamp to viewport
  left = clamp(left, 12, vw - TOOLTIP_W - 12);
  top = clamp(top, 12, vh - tooltipHeight - 12);

  return { position: "fixed", top, left, width: TOOLTIP_W };
}

export function GuidedTour({
  steps,
  currentStep,
  onNext,
  onPrev,
  onExit,
  isWaiting,
}: GuidedTourProps) {
  const step = steps[currentStep];
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(200);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find and measure the target element
  const measureTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      // Scroll into view
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [step]);

  useEffect(() => {
    measureTarget();
    // Re-measure on scroll/resize
    window.addEventListener("scroll", measureTarget, true);
    window.addEventListener("resize", measureTarget);
    return () => {
      window.removeEventListener("scroll", measureTarget, true);
      window.removeEventListener("resize", measureTarget);
    };
  }, [measureTarget]);

  // Measure tooltip height for positioning
  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, [currentStep, targetRect]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onExit();
      } else if (e.key === "ArrowRight" && !isWaiting) {
        onNext();
      } else if (e.key === "ArrowLeft") {
        onPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onNext, onPrev, onExit, isWaiting]);

  if (!step || !targetRect) return null;

  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    top: targetRect.top - PAD,
    left: targetRect.left - PAD,
    width: targetRect.width + PAD * 2,
    height: targetRect.height + PAD * 2,
    borderRadius: 12,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
    zIndex: 9998,
    pointerEvents: "none",
    transition: "all 0.3s ease",
  };

  const tooltipStyle = computeTooltipStyle(
    targetRect,
    step.position,
    tooltipHeight,
  );

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <>
      {/* Backdrop — clicking exits */}
      <div
        className="tour-fade-in fixed inset-0 z-[9997]"
        onClick={onExit}
        aria-hidden
      />

      {/* Spotlight */}
      <div style={spotlightStyle} className="tour-ring-pulse" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{ ...tooltipStyle, zIndex: 9999 }}
        className="tour-tooltip-in rounded-xl border border-border-bright bg-bg-card p-5 shadow-2xl"
      >
        {/* Step counter */}
        <div className="mb-1 text-xs text-text-dim">
          Step {currentStep + 1} of {steps.length}
        </div>

        {/* Title */}
        <h4 className="mb-2 text-sm font-semibold text-text">{step.title}</h4>

        {/* Description */}
        <p className="mb-4 text-sm leading-relaxed text-text-muted">
          {step.description}
        </p>

        {/* Progress dots */}
        <div className="mb-4 flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? "w-4 bg-accent"
                  : i < currentStep
                    ? "w-1.5 bg-accent/40"
                    : "w-1.5 bg-border-bright"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onExit}
            className="text-xs text-text-dim transition-colors hover:text-text-muted"
          >
            Exit tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-bright hover:text-text"
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              disabled={isWaiting}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {isWaiting
                ? "Waiting..."
                : isLast
                  ? "Finish"
                  : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
