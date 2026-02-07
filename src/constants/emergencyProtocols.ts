export interface EmergencyProtocol {
  id: string;
  title: string;
  symptoms: string[];
  doNowSteps: string[];
  callActionText: string;
  color: string;
}

export const EMERGENCY_PROTOCOLS: EmergencyProtocol[] = [
  {
    id: 'heart_attack',
    title: 'Heart Attack',
    symptoms: ['Chest pain/pressure', 'Shortness of breath', 'Pain in arm/jaw', 'Cold sweat', 'Nausea'],
    doNowSteps: [
      'Have person sit down & rest',
      'Loosen tight clothing',
      'Ask if they take chest pain meds',
      'If unresponsive, start CPR',
    ],
    callActionText: 'Call Ambulance',
    color: '$red10',
  },
  {
    id: 'stroke',
    title: 'Stroke',
    symptoms: ['Face drooping', 'Arm weakness', 'Speech difficulty', 'Sudden confusion', 'Trouble seeing'],
    doNowSteps: [
      'Note the time symptoms started',
      'Do not give food or drink',
      'Keep person comfortable',
      'Monitor breathing',
    ],
    callActionText: 'Call Ambulance',
    color: '$orange10',
  },
  {
    id: 'severe_bleeding',
    title: 'Severe Bleeding',
    symptoms: ['Continuous bleeding', 'Large amount of blood loss', 'Signs of shock', 'Rapid pulse'],
    doNowSteps: [
      'Apply direct pressure to wound',
      'Use clean cloth or gauze',
      'Keep pressure until help arrives',
      'Lay person down & raise legs if shock',
    ],
    callActionText: 'Call Ambulance',
    color: '$red9',
  },
  {
    id: 'seizure',
    title: 'Seizure',
    symptoms: ['Uncontrollable shaking', 'Loss of consciousness', 'Staring spell', 'Confusion'],
    doNowSteps: [
      'Clear area of hard objects',
      'Cushion their head',
      'Turn onto side if possible',
      'Time the seizure duration',
      'Do NOT hold them down or put things in mouth',
    ],
    callActionText: 'Call Ambulance',
    color: '$purple10',
  },
  {
    id: 'unconsciousness',
    title: 'Unconsciousness',
    symptoms: ['Unresponsive', 'No reaction to voice/touch', 'Limp body'],
    doNowSteps: [
      'Check for breathing & pulse',
      'If breathing, roll to recovery position',
      'If NOT breathing, start CPR',
      'Keep warm',
    ],
    callActionText: 'Call Ambulance',
    color: '$gray10',
  },
];
