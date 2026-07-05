import { spawn } from "child_process";
import dns from "dns";

// Ensure localhost resolves to IPv4 loopback so fetch doesn't time out on IPv6 resolving
dns.setDefaultResultOrder("ipv4first");

const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("🚀 Starting Next.js Dev Server for E2E integration test...");
  
  // Spawn Next.js dev server on custom port
  const devServer = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  // Ensure dev server gets terminated on script exit
  const cleanup = () => {
    console.log("🧹 Terminating Dev Server...");
    devServer.kill("SIGTERM");
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Poll health endpoint until dev server is online
  console.log("⏳ Waiting for server to be ready...");
  let isReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        const body = await res.json();
        console.log(`✅ Server is online:`, body);
        isReady = true;
        break;
      }
    } catch (e) {
      // Ignore connection errors during startup
    }
    await sleep(2000);
  }

  if (!isReady) {
    console.error("❌ Timeout: Next.js dev server failed to start within 40 seconds.");
    process.exit(1);
  }

  // Trigger research run
  console.log("\n📈 Triggering research run for AAPL...");
  const triggerRes = await fetch(`${BASE_URL}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: "AAPL",
      investmentHorizon: "1-2 years",
      riskTolerance: "moderate",
    }),
  });

  if (!triggerRes.ok) {
    console.error(`❌ Failed to trigger research: ${triggerRes.status}`);
    const errText = await triggerRes.text();
    console.error(errText);
    process.exit(1);
  }

  const { researchId } = await triggerRes.json();
  console.log(`🎯 Research run created! Run ID: ${researchId}`);

  // Poll status endpoint until completed or failed
  let status = "queued";
  let currentNode = "";
  let lastNode = "";

  console.log("⏳ Running specialists & consensus analysis (this may take up to 2 minutes)...");
  
  while (status === "queued" || status === "running") {
    await sleep(4000);
    try {
      const statusRes = await fetch(`${BASE_URL}/api/research/${researchId}/status`);
      if (!statusRes.ok) {
        console.error(`⚠️ Failed to poll status: ${statusRes.status}`);
        continue;
      }
      const data = await statusRes.json();
      status = data.status;
      currentNode = data.currentNode || "initializing";

      if (currentNode !== lastNode) {
        console.log(`📍 Pipeline progressed to node: [${currentNode.toUpperCase()}] (Status: ${status})`);
        lastNode = currentNode;
      }

      if (status === "failed") {
        console.error(`❌ Pipeline failed! Error: ${data.errorMessage}`);
        process.exit(1);
      }
    } catch (e: any) {
      console.warn(`⚠️ Error polling status: ${e.message}`);
    }
  }

  console.log(`\n🎉 Pipeline completed with status: ${status.toUpperCase()}!`);

  // Fetch full details
  console.log("📥 Fetching final research details...");
  const detailRes = await fetch(`${BASE_URL}/api/research/${researchId}`);
  if (!detailRes.ok) {
    console.error("❌ Failed to fetch research details.");
    process.exit(1);
  }

  const details = await detailRes.json();
  
  console.log("\n==============================================");
  console.log(`📊 INVESTMENT RESEARCH REPORT FOR: ${details.run.companyName} (${details.run.ticker})`);
  console.log(`🎯 Decision: ${details.score?.decision || "UNKNOWN"}`);
  console.log(`🔢 Final Score: ${details.score?.finalScore || "N/A"} / 100`);
  console.log("----------------------------------------------");
  console.log(`💼 Business Quality Score: ${details.score?.business}`);
  console.log(`📈 Financial Health Score: ${details.score?.financial}`);
  console.log(`💵 Valuation Score:       ${details.score?.valuation}`);
  console.log(`📰 News & Market Score:    ${details.score?.news}`);
  console.log(`⚠️ Risk Factor Score:     ${details.score?.risk}`);
  console.log(`🔎 Evidence Quality:      ${details.score?.evidenceQuality}`);
  console.log(`⚖️ Contradiction Penalty:  -${details.score?.contradictionPenalty}`);
  console.log("==============================================");

  if (details.report) {
    console.log("\n📝 Synthesized Thesis:");
    console.log(details.report.thesis);
    
    console.log("\n🟢 Bull Case Elements:");
    details.report.bullCase?.forEach((item: string) => console.log(`  - ${item}`));
    
    console.log("\n🔴 Bear Case Elements:");
    details.report.bearCase?.forEach((item: string) => console.log(`  - ${item}`));
    
    console.log("\n⚡ Key Identified Risks:");
    details.report.keyRisks?.forEach((item: string) => console.log(`  - ${item}`));
    
    console.log("\n📋 Summary:");
    console.log(details.report.summary);
  } else {
    console.log("\n⚠️ No synthesized report available.");
  }

  // Fetch evidence & contradictions list
  const evRes = await fetch(`${BASE_URL}/api/research/${researchId}/evidence`);
  const ctRes = await fetch(`${BASE_URL}/api/research/${researchId}/contradictions`);
  
  if (evRes.ok) {
    const evData = await evRes.json();
    console.log(`\n🔍 Collected ${evData.evidence?.length || 0} items of evidence.`);
  }
  
  if (ctRes.ok) {
    const ctData = await ctRes.json();
    console.log(`⚖️ Detected ${ctData.contradictions?.length || 0} contradictions in evidence.`);
    ctData.contradictions?.forEach((ct: any, index: number) => {
      console.log(`   [${index + 1}] Severity: ${ct.severity.toUpperCase()} | Confidence: ${ct.confidence}`);
      console.log(`       Description: ${ct.description}`);
    });
  }

  console.log("\n✅ E2E Integration test succeeded! Exiting.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ E2E Integration test script failed:", err);
  process.exit(1);
});
