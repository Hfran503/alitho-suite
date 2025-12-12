// Default categories available for inventory items
// These are suggestions - users can add items with any category value
export const DEFAULT_ITEM_CATEGORIES = [
  'Raw Materials',
  'Finished Goods',
  'Packaging',
  'Components',
  'Supplies',
  'Equipment',
  'Other',
]

// Map of normalized keys to standard category names
// Allows flexible input like "raw_materials", "raw-materials", "rawmaterials", "Raw Materials"
const CATEGORY_ALIASES: Record<string, string> = {
  'raw materials': 'Raw Materials',
  'rawmaterials': 'Raw Materials',
  'raw_materials': 'Raw Materials',
  'finished goods': 'Finished Goods',
  'finishedgoods': 'Finished Goods',
  'finished_goods': 'Finished Goods',
  'packaging': 'Packaging',
  'components': 'Components',
  'supplies': 'Supplies',
  'equipment': 'Equipment',
  'other': 'Other',
}

/**
 * Normalizes a category input to match standard format
 * Handles variations like: "raw_materials", "Raw Materials", "rawmaterials"
 * Returns the standardized category or the original if not a known category
 */
export function normalizeCategory(input: string | null | undefined): string | null {
  if (!input) return null

  // Normalize: lowercase, remove special chars except spaces
  const normalized = input.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
  const noSpaces = normalized.replace(/\s/g, '')

  // Check aliases
  if (CATEGORY_ALIASES[normalized]) {
    return CATEGORY_ALIASES[normalized]
  }
  if (CATEGORY_ALIASES[noSpaces]) {
    return CATEGORY_ALIASES[noSpaces]
  }

  // If not a known alias, return the original trimmed value
  return input.trim()
}
