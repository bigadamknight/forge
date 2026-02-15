export const INTERVIEW_DEPTHS = ["quick", "standard", "deep"] as const
export type InterviewDepth = (typeof INTERVIEW_DEPTHS)[number]

export const DEPTH_PRESETS = {
  quick: {
    label: "Quick",
    description: "A focused 5-minute conversation covering the essentials",
    estimatedMinutes: 5,
    sections: { min: 2, max: 3 },
    questionsPerSection: { min: 1, max: 2 },
    extractionsPerQuestion: 1,
    voiceMaxDuration: 600,
  },
  standard: {
    label: "Standard",
    description: "A thorough 20-minute interview for a well-rounded guide",
    estimatedMinutes: 20,
    sections: { min: 4, max: 6 },
    questionsPerSection: { min: 2, max: 4 },
    extractionsPerQuestion: 2,
    voiceMaxDuration: 1800,
  },
  deep: {
    label: "Deep Dive",
    description: "An in-depth 60-minute session for comprehensive coverage",
    estimatedMinutes: 60,
    sections: { min: 6, max: 8 },
    questionsPerSection: { min: 3, max: 5 },
    extractionsPerQuestion: 3,
    voiceMaxDuration: 3600,
  },
} as const
