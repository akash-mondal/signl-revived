import cron from 'node-cron';
import { JobManager } from './storage';
import { executeDeepIntelligence } from '../deep-intelligence'; // UPDATED IMPORT
import { RECURRING_TEMPLATES } from './templates';
import { WarRoomMissionContext, Frequency, RecurringJob } from '../types';

function calculateNextRun(freq: Frequency): string {
  const now = new Date();
  const next = new Date(now);
  
  if (freq === 'DAILY_MORNING') {
    next.setDate(now.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  } 
  else if (freq === 'WEEKLY_MONDAY') {
    const dist = (1 + 7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + dist);
    next.setHours(9, 0, 0, 0);
  } 
  else if (freq === 'WEEKLY_FRIDAY') {
    const dist = (5 + 7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + dist);
    next.setHours(9, 0, 0, 0);
  }
  else if (freq === 'MONTHLY_1ST') {
    next.setMonth(now.getMonth() + 1);
    next.setDate(1);
    next.setHours(9, 0, 0, 0);
  }

  return next.toISOString();
}

function generateMissionContext(job: RecurringJob): WarRoomMissionContext {
    const template = RECURRING_TEMPLATES[job.templateId];

    return {
        identity: {
            fullName: "Subscriber",
            email: job.userEmail,
            role: "Founder"
        },
        company: {
            name: "Subscriber Company",
            websiteDomain: "https://example.com",
            foundingYear: 2024,
            headquartersLocation: "Remote",
            employeeCountRange: "1-10",
            primaryIndustry: "Tech",
            businessModel: "B2B SaaS",
            currentFundingStage: "Seed"
        },
        strategy: {
            coreValueProposition: template.name,
            problemBeingSolved: template.description,
            idealCustomerProfile: "Founders",
            northStarMetric: "Retention",
            pricingStrategy: "Freemium (Product Led)",
            primaryGtmMotion: "Product Led Growth (Self Serve)",
            targetGeography: ["Global"],
            positioning: "Speed / Performance King",
            unfairAdvantage: "Deep Tech / R&D"
        },
        product: {
            primaryFeatureSet: ["Intelligence"],
            complianceRequirements: [],
            integrationsList: [],
            deploymentMethod: "Cloud",
            mobileAppAvailable: false,
            apiFirst: true
        },
        anxiety: {
            biggestFear: "Being blindsided",
            whatKeepsYouUpAtNight: "Competitors",
            knownWeaknessInternal: "None",
            topReasonForChurn: "Cost",
            topReasonForLossInSales: "Features"
          },
          targets: {
            competitorNames: [job.targetName],
            specificRumorsToVerify: job.customQuery ? [job.customQuery] : [],
            perceivedThreatLevel: "Existential (Kill or be Killed)",
            specificQuestionsForAgent: job.customQuery ? [job.customQuery] : [],
            blacklistedDomains: []
          },
          outputPreferences: {
            reportTone: "Ruthless VC (Critique)",
            includeRawSources: true,
            focusAreas: ["Pricing", "Product", "Sentiment"],
            language: "English"
          }
    };
}

export function startScheduler() {
  console.log("⏰ Signl Scheduler Online");

  cron.schedule('* * * * *', async () => {
    const dueJobs = JobManager.getDueJobs();
    
    if (dueJobs.length > 0) {
      console.log(`⚡ Processing ${dueJobs.length} recurring missions...`);
    }

    for (const job of dueJobs) {
      try {
        const missionContext = generateMissionContext(job);

        // Updated to use the new engine
        await executeDeepIntelligence(
          "RECURRING-" + job.id, 
          missionContext
        );

        const nextRun = calculateNextRun(job.frequency);
        JobManager.updateJobAfterRun(job.id, new Date(nextRun));
        
      } catch (e) {
        console.error(`❌ Job ${job.id} failed:`, e);
      }
    }
  });
}