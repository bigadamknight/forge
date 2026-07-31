import type { ExpertProfile } from './api'

export interface FieldDef {
  key: keyof ExpertProfile
  label: string
}

export const BASICS: FieldDef[] = [
  { key: 'expertName', label: 'Name' },
  { key: 'domain', label: 'Area of Expertise' },
  { key: 'targetAudience', label: 'Target Audience' },
]

export const BACKGROUND: FieldDef[] = [
  { key: 'yearsExperience', label: 'Experience' },
  { key: 'specializations', label: 'Specializations' },
  { key: 'notableAchievements', label: 'Achievements' },
  { key: 'industriesOrContexts', label: 'Industries / Contexts' },
]

export const PERSPECTIVE: FieldDef[] = [
  { key: 'uniqueApproach', label: 'Unique Approach' },
  { key: 'commonMistakes', label: 'Common Mistakes' },
  { key: 'passionArea', label: 'Passion Area' },
  { key: 'problemsTheySolve', label: 'Problems They Solve' },
]

export const ALL_FIELDS: FieldDef[] = [...BASICS, ...BACKGROUND, ...PERSPECTIVE]

export const TOTAL_FIELDS = ALL_FIELDS.length

export function isCaptured(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return !!value
}

export function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

export function countCaptured(profile: ExpertProfile): number {
  return Object.values(profile).filter(isCaptured).length
}
