/**
 * Router Agent — tool orchestrator: detect intent, build tool suggestions,
 * or call LLM for GENERAL. Returns replyText + optional suggestedTool.
 */

import type { RexIntent } from './intents';
import { detectIntent } from './intents';
import { handleEmergency } from './handlers/emergencyHandler';
import { handleTriage } from './handlers/triageHandler';
import { handleBooking } from './handlers/bookingHandler';
import { handleLiteracy } from './handlers/literacyHandler';
import { getAIResponse } from '../services/llmService';
import { getTodayPlan } from '../tools/todayPlanTool';

export type SuggestedTool =
  | { type: 'BOOK_APPOINTMENT'; payload: { title: string; datetime: string } };

export interface RouteResult {
  intent: RexIntent;
  replyText: string;
  suggestedTool?: SuggestedTool;
}

export interface RouteContext {
  recentMessages?: { role: 'user' | 'assistant'; content: string }[];
}

/**
 * Route a user message: detect intent, call handler or LLM (GENERAL).
 * Returns replyText and optional suggestedTool for UI confirmation (e.g. Book Appointment).
 */
export async function routeMessage(
  userText: string,
  source: 'chat' | 'voice' | 'call' = 'chat',
  context: RouteContext = {}
): Promise<RouteResult> {
  const intent = detectIntent(userText);

  switch (intent) {
    case 'EMERGENCY':
      return { intent: 'EMERGENCY', replyText: handleEmergency() };
    case 'TRIAGE':
      return { intent: 'TRIAGE', replyText: handleTriage() };
    case 'BOOKING': {
      const result = await handleBooking(userText, source);
      return {
        intent: 'BOOKING',
        replyText: result.replyText,
        suggestedTool: result.suggestedTool,
      };
    }
    case 'LITERACY':
      return { intent: 'LITERACY', replyText: handleLiteracy() };
    case 'TODAY_PLAN': {
      const plan = getTodayPlan();
      return { intent: 'TODAY_PLAN', replyText: plan };
    }
    case 'GENERAL':
    default: {
      const reply = await getAIResponse(userText, {
        recentMessages: context.recentMessages,
      });
      return { intent: 'GENERAL', replyText: reply };
    }
  }
}
