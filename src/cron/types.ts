export type BusinessModel = 
  | "B2B SaaS" | "B2C Marketplace" | "D2C E-commerce" | "Enterprise Service" 
  | "Hardware" | "Fintech Infrastructure" | "Social Consumer" | "API First Platform" 
  | "Open Source Core" | "GovTech" | "EdTech" | "BioTech / Pharma" | (string & {});

export type FundingStage = 
  | "Bootstrapped" | "Pre-Seed" | "Seed" | "Series A" | "Series B"
  | "Series C+" | "Public Company" | "Private Equity Backed" | "ICO / Token Launch" | (string & {});

export type PricingStrategy = 
  | "Freemium (Product Led)" | "Usage Based (Pay As You Go)" | "Per Seat (Monthly/Annual)" 
  | "Flat Rate Subscription" | "Enterprise License (Contact Sales)" | "Transaction Fee (%)" 
  | "Hardware + Subscription" | "Ad Supported" | "Dynamic / Surge Pricing" | (string & {});

export type GoToMarketMotion = 
  | "Product Led Growth (Self Serve)" | "Sales Led (Top Down)" | "Community Led" 
  | "Channel Partners / Resellers" | "Viral Loop / Referral" | "Programmatic SEO" 
  | "Field Sales" | (string & {});

export type TargetGeography = 
  | "Global" | "North America" | "Europe (GDPR focus)" | "APAC" | "LATAM" 
  | "MEA" | "DACH Region" | "Nordics" | "Southeast Asia" | (string & {});

export type CompetitivePositioning = 
  | "Low Cost Leader" | "Premium / Luxury" | "Niche Specialist" | "All-in-One Platform" 
  | "Privacy / Security First" | "Speed / Performance King" | "Ease of Use / UX Focus" 
  | "Open Source Alternative" | (string & {});

export type KeyUnfairAdvantage = 
  | "Proprietary IP / Patent" | "Network Effects" | "Data Moat" | "Regulatory Capture" 
  | "Founder Brand / Audience" | "Exclusive Partnerships" | "Lowest Cost Structure" 
  | "Deep Tech / R&D" | (string & {});

export type ReportTone = 
  | "Ruthless VC (Critique)" | "Strategic Advisor (Constructive)" | "Technical Architect (Deep Dive)" 
  | "Sales Battlecard (Attack Points)" | "Journalistic / Investigative" | (string & {});

export type PerceivedThreatLevel = 
  | "Existential (Kill or be Killed)" | "Annoying (Feature Parity)" | "Irrelevant (Different Market)" 
  | "Unknown / Dark Horse" | (string & {});

export interface FounderIdentity {
  fullName: string;
  email: string;
  role: string;
  linkedinProfile?: string;
  twitterHandle?: string;
}

export interface CompanyProfile {
  name: string;
  websiteDomain: string;
  foundingYear: number;
  headquartersLocation: string;
  employeeCountRange: "1-10" | "11-50" | "51-200" | "201-500" | "500+" | (string & {});
  primaryIndustry: string;
  businessModel: BusinessModel;
  currentFundingStage: FundingStage;
  totalFundingRaised?: string;
}

export interface StrategicNorthStar {
  coreValueProposition: string;
  problemBeingSolved: string;
  idealCustomerProfile: string;
  northStarMetric: string;
  pricingStrategy: PricingStrategy;
  primaryGtmMotion: GoToMarketMotion;
  targetGeography: TargetGeography[];
  positioning: CompetitivePositioning;
  unfairAdvantage: KeyUnfairAdvantage;
  keyPartnerships?: string[];
}

export interface ProductDetails {
  primaryFeatureSet: string[];
  technicalStackCore?: string[];
  complianceRequirements: string[];
  integrationsList: string[];
  deploymentMethod: "Cloud" | "On-Prem" | "Hybrid" | "Edge" | (string & {});
  mobileAppAvailable: boolean;
  apiFirst: boolean;
}

export interface TheNightmareScenario {
  biggestFear: string;
  whatKeepsYouUpAtNight: string;
  knownWeaknessInternal: string;
  topReasonForChurn: string;
  topReasonForLossInSales: string;
}

export interface CompetitorIntelligenceTarget {
  competitorNames: string[];
  specificRumorsToVerify: string[];
  perceivedThreatLevel: PerceivedThreatLevel;
  specificQuestionsForAgent: string[];
  blacklistedDomains?: string[];
}

export interface OutputPreferences {
  reportTone: ReportTone;
  includeRawSources: boolean;
  focusAreas: ("Pricing" | "Product" | "Sentiment" | "Hiring" | "Legal" | "Patents" | "Traffic")[];
  language: "English" | "Spanish" | "French" | "German" | "Japanese" | (string & {});
}

export interface WarRoomMissionContext {
  identity: FounderIdentity;
  company: CompanyProfile;
  strategy: StrategicNorthStar;
  product: ProductDetails;
  anxiety: TheNightmareScenario;
  targets: CompetitorIntelligenceTarget;
  outputPreferences: OutputPreferences;
}

// --- NEW V3 TYPES FOR KNOWLEDGE GRAPH ---

export interface Evidence {
  source: string;
  snippet: string;
  tool: string;
  credibility: number; // 0-100
  timestamp: string;
  url?: string;
}

export interface Finding {
  id: string;
  category: 'PRICING' | 'PRODUCT' | 'PEOPLE' | 'SENTIMENT' | 'STRATEGY';
  signal: string;
  evidence: Evidence[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  relatedFindings: string[]; // IDs of other findings
}

export interface Hypothesis {
  claim: string;
  evidenceIds: string[];
  validationStatus: 'CONFIRMED' | 'REFUTED' | 'PENDING';
  implications: string;
}