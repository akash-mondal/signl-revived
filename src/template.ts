import { Template } from 'e2b';

export const template = Template()
  .fromTemplate('mcp-gateway') 
  .addMcpServer([
    'exa',
    'perplexityAsk',
    'resend',
    'memory',
    'sequentialthinking'
  ])
  .setEnvs({
    EXA_API_KEY: process.env.EXA_API_KEY!,
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    SENDER_EMAIL_ADDRESS: process.env.SENDER_EMAIL!,
    REPLY_TO_EMAIL_ADDRESSES: process.env.SENDER_EMAIL!
  });

export const alias = 'signl-v5-autonomous';