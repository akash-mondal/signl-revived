import 'dotenv/config';
import { executeDeepIntelligence } from './deep-intelligence';
import { WarRoomMissionContext } from './types';

const DEEP_TEST_CONTEXT: WarRoomMissionContext = {
  identity: {
    fullName: "Akash",
    email: "thatspacebiker@gmail.com",
    role: "Founder"
  },
  company: {
    name: "VectorVault",
    websiteDomain: "https://vectorvault.io",
    foundingYear: 2024,
    headquartersLocation: "San Francisco",
    employeeCountRange: "1-10",
    primaryIndustry: "Database",
    businessModel: "Open Source Core",
    currentFundingStage: "Seed"
  },
  strategy: {
    coreValueProposition: "Local-first Vector DB for Privacy",
    problemBeingSolved: "Cloud data leakage",
    idealCustomerProfile: "Healthcare Startups",
    northStarMetric: "Local Installs",
    pricingStrategy: "Enterprise License (Contact Sales)",
    primaryGtmMotion: "Product Led Growth (Self Serve)",
    targetGeography: ["North America"],
    positioning: "Privacy / Security First",
    unfairAdvantage: "Deep Tech / R&D"
  },
  product: {
    primaryFeatureSet: ["Local Embedding", "Encryption"],
    complianceRequirements: ["HIPAA"],
    integrationsList: ["LangChain"],
    deploymentMethod: "On-Prem",
    mobileAppAvailable: false,
    apiFirst: true
  },
  anxiety: {
    biggestFear: "Competitors launch on-prem containers",
    whatKeepsYouUpAtNight: "Commoditization",
    knownWeaknessInternal: "Speed",
    topReasonForChurn: "Performance",
    topReasonForLossInSales: "Brand"
  },
  targets: {
    competitorNames: ["Pinecone", "ChromaDB"],
    specificRumorsToVerify: [],
    perceivedThreatLevel: "Existential (Kill or be Killed)",
    specificQuestionsForAgent: [],
    blacklistedDomains: []
  },
  outputPreferences: {
    reportTone: "Ruthless VC (Critique)",
    includeRawSources: true,
    focusAreas: ["Pricing", "Product", "Sentiment"],
    language: "English"
  }
};

async function runDeepTest() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              SIGNL INTELLIGENCE TEST (5 MIN)                 ║
╠══════════════════════════════════════════════════════════════╣
║  Target Duration: 5 minutes                                  ║
║  Targets: Pinecone, ChromaDB                                 ║
║  Features: Knowledge Graph, Recency Filter, Strategic UI     ║
╚══════════════════════════════════════════════════════════════╝
  `);

  try {
    // Pass '5' as the third argument for duration
    await executeDeepIntelligence("TEST-FAST-RUN", DEEP_TEST_CONTEXT, 5);
    
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     TEST COMPLETE                            ║
╠══════════════════════════════════════════════════════════════╣
║  Check your email (thatspacebiker@gmail.com) for the report  ║
╚══════════════════════════════════════════════════════════════╝
    `);
  } catch (e) {
    console.error("❌ TEST FAILED:", e);
  }
}

runDeepTest();