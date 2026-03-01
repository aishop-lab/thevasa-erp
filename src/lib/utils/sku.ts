/**
 * SKU generation, parsing, and validation utilities.
 *
 * SKU format convention:
 *   BASE-SIZE-COLOR
 *
 * Examples:
 *   "TV-SHIRT-001-M-BLK"  (base: TV-SHIRT-001, size: M, color: BLK)
 *   "TV-DRESS-042-S"      (base: TV-DRESS-042, size: S, no color)
 *   "TV-ACC-010"          (base only, no size or color)
 */

/** Valid SKU pattern: alphanumeric segments separated by hyphens. */
const SKU_REGEX = /^[A-Z0-9]+(-[A-Z0-9]+)*$/i;

/** Common size codes used in the SKU system. */
const KNOWN_SIZES = new Set([
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "FS", // Free Size
]);

/**
 * Generate a variant SKU from a product base SKU plus optional size and color.
 *
 * @param productSku - The base product SKU, e.g. "TV-SHIRT-001".
 * @param size - Optional size code, e.g. "M", "L", "XL".
 * @param color - Optional color code, e.g. "BLK", "WHT", "RED".
 * @returns The assembled variant SKU.
 */
export function generateVariantSku(
  productSku: string,
  size?: string,
  color?: string
): string {
  const parts = [productSku.toUpperCase().trim()];

  if (size && size.trim()) {
    parts.push(size.toUpperCase().trim());
  }

  if (color && color.trim()) {
    parts.push(color.toUpperCase().trim());
  }

  return parts.join("-");
}

/**
 * Parse a variant SKU into its component parts.
 *
 * Heuristic: scans hyphen-separated segments from the end looking for
 * known size codes. Anything after the size is treated as a color code.
 *
 * @param sku - The full variant SKU string.
 * @returns Parsed parts: `base` (always present), optional `size` and `color`.
 */
export function parseSku(sku: string): {
  base: string;
  size?: string;
  color?: string;
} {
  const normalized = sku.toUpperCase().trim();
  const segments = normalized.split("-");

  if (segments.length <= 1) {
    return { base: normalized };
  }

  // Try to find a size segment (scanning from the end, max 2 trailing segments)
  let sizeIndex = -1;

  for (let i = segments.length - 1; i >= 1 && i >= segments.length - 2; i--) {
    if (KNOWN_SIZES.has(segments[i])) {
      sizeIndex = i;
      break;
    }
  }

  // No recognized size: everything is the base
  if (sizeIndex === -1) {
    // Check if the last segment looks like a color code (2-4 alpha chars)
    // and the second-to-last is a size -- if neither matches, it's all base.
    return { base: normalized };
  }

  const base = segments.slice(0, sizeIndex).join("-");
  const size = segments[sizeIndex];
  const colorParts = segments.slice(sizeIndex + 1);
  const color = colorParts.length > 0 ? colorParts.join("-") : undefined;

  return {
    base: base || normalized,
    size,
    ...(color ? { color } : {}),
  };
}

/**
 * Validate that a SKU string follows the expected format.
 *
 * Rules:
 *   - Must not be empty.
 *   - Must contain only alphanumeric characters and hyphens.
 *   - Must not start or end with a hyphen.
 *   - Must not contain consecutive hyphens.
 *   - Length must be between 2 and 50 characters.
 *
 * @param sku - The SKU string to validate.
 * @returns `true` if the SKU is valid, `false` otherwise.
 */
export function validateSku(sku: string): boolean {
  if (!sku || typeof sku !== "string") {
    return false;
  }

  const trimmed = sku.trim();

  if (trimmed.length < 2 || trimmed.length > 50) {
    return false;
  }

  if (trimmed.includes("--")) {
    return false;
  }

  return SKU_REGEX.test(trimmed);
}
