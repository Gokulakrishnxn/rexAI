/**
 * Router Agent — routes user messages to intent handlers or medAgentService.
 * No extra model calls. Lightweight keyword-based routing.
 */

import type { RexIntent } from './intents';
import { detectIntent } from './intents';
import { handleEmergency } from './handlers/emergencyHandler';
import { handleTriage } from './handlers/triageHandler';
import { handleBooking } from './handlers/bookingHandler';
import { handleLiteracy } from './handlers/literacyHandler';
import { getGeneralReply } from '../services/medAgentService';

export interface RouteResult {
  intent: RexIntent;
  reply: string;
}

/**
 * Route a user message: detect intent, call handler or GENERAL fallback.
 * source: 'chat' | 'voice' | 'call' for tool calls (e.g. booking).
 */
export async function routeMessage(
  userText: string,
  source: 'chat' | 'voice' | 'call' = 'chat'
): Promise<RouteResult> {
  const intent = detectIntent(userText);

  switch (intent) {
    case 'EMERGENCY':
      return { intent: 'EMERGENCY', reply: handleEmergency() };
    case 'TRIAGE':
      return { intent: 'TRIAGE', reply: handleTriage() };
    case 'BOOKING':
      return { intent: 'BOOKING', reply: await handleBooking(userText, source) };
    case 'LITERACY':
      return { intent: 'LITERACY', reply: handleLiteracy() };
    case 'GENERAL':
    default:
      const reply = await getGeneralReply(userText);
      return { intent: 'GENERAL', reply };
  }
}
