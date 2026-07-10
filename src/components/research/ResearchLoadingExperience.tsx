"use client";

import React, { useState, useEffect } from "react";

interface ResearchLoadingExperienceProps {
  ticker: string;
  companyName?: string;
  isExiting: boolean;
}

const loadingMessages = [
  "Resolving company registry identities...",
  "Collecting available market evidence from registries...",
  "Reviewing 2–3 year daily historical price behaviors...",
  "Checking balance sheet assets & leverage ratios...",
  "Reading operating cash-flow statement evidence...",
  "Aggregating recent financial market news feeds...",
  "Understanding valuation, P/E, and market value context...",
  "Checking multi-provider evidence completeness...",
  "Preparing raw statement evidence for LLM interpretation...",
  "Orchestrating AI consensus models for final investment synthesis..."
];

export default function ResearchLoadingExperience({
  ticker,
  companyName = "Company Profile",
  isExiting
}: ResearchLoadingExperienceProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate atmospheric loading messages every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Orbiting evidence nodes definitions
  const nodes = [
    {
      id: "price",
      label: "Live Price",
      angle: 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: "history",
      label: "Price History",
      angle: 60,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: "cashflow",
      label: "Cash Flow",
      angle: 120,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: "news",
      label: "Market News",
      angle: 180,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      )
    },
    {
      id: "marketval",
      label: "Market Value",
      angle: 240,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    {
      id: "financials",
      label: "Financials",
      angle: 300,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    }
  ];

  // Floating background symbols definitions
  const floatingSymbols = [
    { text: "₹", top: "15%", left: "12%", delay: "0s", duration: "12s" },
    { text: "$", top: "25%", left: "82%", delay: "1.5s", duration: "9s" },
    { text: "%", top: "70%", left: "15%", delay: "3s", duration: "11s" },
    { text: "↑", top: "12%", left: "70%", delay: "0.5s", duration: "8s" },
    { text: "↓", top: "78%", left: "78%", delay: "2.2s", duration: "10s" },
    { text: "€", top: "45%", left: "88%", delay: "4s", duration: "13s" },
    { text: "¥", top: "60%", left: "8%", delay: "2s", duration: "14s" },
    { text: ticker, top: "85%", left: "45%", delay: "1s", duration: "7s", isTicker: true }
  ];

  return (
    <div className={`w-full max-w-2xl mx-auto py-12 px-6 flex flex-col items-center space-y-10 relative overflow-hidden transition-all duration-500 ${isExiting ? "opacity-0 scale-95" : "opacity-100"}`}>
      
      {/* Dynamic inline styles for orbit and floating components */}
      <style jsx global>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes counter-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pulse-core {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.2); }
          50% { transform: scale(1.06); box-shadow: 0 0 20px 8px rgba(0, 0, 0, 0.08); }
        }
        @keyframes float-up {
          0% { transform: translateY(20px); opacity: 0; }
          10% { opacity: 0.25; }
          90% { opacity: 0.25; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
        @keyframes message-fade {
          0%, 100% { opacity: 0.6; transform: translateY(2px); }
          50% { opacity: 1; transform: translateY(0); }
        }
        @keyframes signal-grow {
          0%, 100% { height: 12px; }
          50% { height: 28px; }
        }
        
        .orbit-wrapper {
          animation: orbit 24s linear infinite;
        }
        .orbit-node-wrapper {
          animation: counter-orbit 24s linear infinite;
        }
        .pulse-center {
          animation: pulse-core 3s ease-in-out infinite;
        }
        .floating-element {
          animation: float-up 10s ease-in-out infinite;
        }
        .rotating-message {
          animation: message-fade 3.5s ease-in-out infinite;
        }
        
        /* Exit state classes */
        .exit-contract .orbit-node-container {
          transform: translate(0, 0) !important;
          opacity: 0;
          transition: all 600ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .exit-contract .pulse-center {
          transform: scale(1.3) !important;
          opacity: 0;
          transition: all 600ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @media (prefers-reduced-motion: reduce) {
          .orbit-wrapper, .orbit-node-wrapper, .floating-element, .rotating-message, .pulse-center {
            animation: none !important;
            transform: none !important;
          }
          .pulse-center {
            border: 2px solid #111111 !important;
          }
        }
      `}</style>

      {/* Floating Background Financial Symbols */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0">
        {floatingSymbols.map((sym, idx) => (
          <span
            key={idx}
            className={`absolute font-mono text-xs font-bold text-foreground-muted/30 floating-element ${
              sym.isTicker ? "bg-neutral-100 px-2 py-0.5 border border-neutral-200 font-bold text-neutral-600/40" : ""
            }`}
            style={{
              top: sym.top,
              left: sym.left,
              animationDelay: sym.delay,
              animationDuration: sym.duration
            }}
          >
            {sym.text}
          </span>
        ))}
      </div>

      {/* Header Info */}
      <div className="text-center space-y-2 z-10">
        <span className="inline-block px-3 py-1 border border-foreground text-foreground text-2xs uppercase tracking-widest font-mono font-bold">
          Gathering Evidence
        </span>
        <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
          Auditing {companyName || ticker}
        </h2>
        <p className="text-xs text-foreground-secondary font-medium">
          Ticker: <span className="font-mono font-black text-foreground bg-neutral-100 border border-foreground px-1.5 py-0.5">{ticker}</span>
        </p>
      </div>

      {/* Central Interactive Evidence Orbit Loader */}
      <div className={`relative w-80 h-80 flex items-center justify-center z-10 ${isExiting ? "exit-contract" : ""}`}>
        
        {/* Orbit Tracks */}
        <div className="absolute w-64 h-64 border border-neutral-300 rounded-full pointer-events-none" />
        <div className="absolute w-44 h-44 border border-dashed border-neutral-300 rounded-full pointer-events-none" />

        {/* Orbiting nodes wrapper */}
        <div className="absolute inset-0 orbit-wrapper">
          {nodes.map((node) => {
            const rad = (node.angle * Math.PI) / 180;
            const x = Math.round(Math.cos(rad) * 120);
            const y = Math.round(Math.sin(rad) * 120);

            return (
              <div
                key={node.id}
                className="absolute orbit-node-container transition-transform duration-300"
                style={{
                  top: `calc(50% + ${y}px - 20px)`,
                  left: `calc(50% + ${x}px - 20px)`,
                  width: "40px",
                  height: "40px"
                }}
              >
                {/* Orbit node with hover interaction */}
                <div className="orbit-node-wrapper w-full h-full">
                  <div className="relative group w-full h-full bg-white border border-foreground hover:bg-neutral-50 shadow-[2px_2px_0px_0px_#111111] flex items-center justify-center text-foreground transition-all cursor-pointer">
                    {node.icon}
                    
                    {/* Tooltip on Hover */}
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-foreground text-white text-8xs font-bold px-2 py-0.5 border border-foreground transition-transform pointer-events-none whitespace-nowrap z-20 font-mono">
                      {node.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Central Research Core */}
        <div className="absolute z-10 w-28 h-28 rounded-none border border-foreground flex items-center justify-center p-1.5 bg-white pulse-center shadow-[3px_3px_0px_0px_#111111] select-none">
          <div className="w-full h-full bg-foreground flex flex-col justify-center items-center text-center p-2">
            <span className="font-mono text-sm font-black text-white tracking-tight truncate max-w-full">
              {ticker}
            </span>
            <span className="text-8xs text-neutral-300 font-bold uppercase tracking-wider mt-0.5 font-mono">
              AUDIT CORE
            </span>
          </div>
        </div>

        {/* Mini Candlestick visual signal decoration */}
        <div className="absolute bottom-2 flex items-end gap-1 pointer-events-none">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-neutral-300" />
              <div 
                className="w-1.5 bg-foreground"
                style={{
                  animation: `signal-grow ${1 + i * 0.3}s ease-in-out infinite`,
                  height: "16px"
                }}
              />
              <div className="w-0.5 h-2 bg-neutral-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Rotating Human-Readable Diagnostic Messages */}
      <div className="text-center w-full max-w-md h-12 flex items-center justify-center z-10 px-4">
        <p className="text-xs font-mono font-bold text-foreground-secondary leading-relaxed rotating-message">
          {loadingMessages[messageIndex]}
        </p>
      </div>

      {/* Footer Transparency & Fact notes */}
      <div className="text-center pt-4 border-t border-foreground w-full max-w-xs z-10">
        <p className="text-6xs text-foreground-muted uppercase tracking-wider font-bold font-mono">
          Factual Sourcing Notice
        </p>
        <p className="text-7xs text-foreground-muted leading-relaxed">
          Only resolved evidence is interpreted. Missing registry points are reported as N/A, never fabricated.
        </p>
      </div>
    </div>
  );
}
