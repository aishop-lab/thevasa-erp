/**
 * Currency formatting utilities for INR (Indian Rupees).
 */

const INR_LOCALE = "en-IN";

/**
 * Format a number as Indian Rupees.
 * @param amount - The numeric amount to format.
 * @param currency - ISO 4217 currency code (defaults to "INR").
 * @returns Formatted currency string, e.g. "₹1,234.56".
 */
export function formatCurrency(
  amount: number,
  currency: string = "INR"
): string {
  return new Intl.NumberFormat(INR_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse a currency-formatted string back to a number.
 * Strips currency symbols (₹, $, etc.), commas, and whitespace.
 * @param value - The currency string to parse, e.g. "₹1,234.56" or "1,234.56".
 * @returns The numeric value, or NaN if the string cannot be parsed.
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols, commas, spaces, and non-breaking spaces
  const cleaned = value.replace(/[₹$€£¥,\s\u00A0]/g, "").trim();
  const result = parseFloat(cleaned);
  return result;
}

/**
 * Format a number as a compact Indian currency string.
 * Uses Indian numbering conventions:
 *   - K for thousands (1,000+)
 *   - L for lakhs (1,00,000+)
 *   - Cr for crores (1,00,00,000+)
 *
 * @param amount - The numeric amount to format.
 * @returns Compact formatted string, e.g. "₹1.2K", "₹1.2L", "₹1.2Cr".
 */
export function formatCompactCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absAmount >= 1_00_00_000) {
    // Crores (10 million+)
    const value = absAmount / 1_00_00_000;
    return `${sign}₹${formatCompactNumber(value)}Cr`;
  }

  if (absAmount >= 1_00_000) {
    // Lakhs (100 thousand+)
    const value = absAmount / 1_00_000;
    return `${sign}₹${formatCompactNumber(value)}L`;
  }

  if (absAmount >= 1_000) {
    // Thousands
    const value = absAmount / 1_000;
    return `${sign}₹${formatCompactNumber(value)}K`;
  }

  // Below 1,000 -- show full value
  return `${sign}₹${absAmount.toFixed(absAmount % 1 === 0 ? 0 : 2)}`;
}

/**
 * Internal helper to format a compact number with up to one decimal place.
 * Drops the decimal if it would be ".0".
 */
function formatCompactNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}
