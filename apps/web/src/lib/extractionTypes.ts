import {
  STANDARD_EXTRACTION_TYPES,
  getExtractionTypes as getExtractionTypesBase,
  type CustomExtractionType,
  type ExtractionTypeDefinition,
} from '@forge/shared'

export type { CustomExtractionType, ExtractionTypeDefinition }
export { STANDARD_EXTRACTION_TYPES }

// Backward-compatible map format
export const EXTRACTION_TYPES: Record<string, { label: string; color: string }> = Object.fromEntries(
  STANDARD_EXTRACTION_TYPES.map((t) => [t.key, { label: t.label, color: t.color }])
)

export const EXTRACTION_TYPE_KEYS = STANDARD_EXTRACTION_TYPES.map((t) => t.key)

// Merged types including workspace custom types
export function getMergedExtractionTypes(customTypes?: CustomExtractionType[]): Record<string, { label: string; color: string; description: string }> {
  const types = getExtractionTypesBase(customTypes)
  return Object.fromEntries(
    Array.from(types.entries()).map(([key, t]) => [key, { label: t.label, color: t.color, description: t.description }])
  )
}

export function getMergedExtractionTypeKeys(customTypes?: CustomExtractionType[]): string[] {
  return Array.from(getExtractionTypesBase(customTypes).keys())
}
