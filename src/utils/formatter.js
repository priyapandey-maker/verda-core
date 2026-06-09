/**
 * @file formatter.js
 * @description Central utility for date conversions, localized parsing, and date differences.
 */

/**
 * Formats a Date object to YYYY-MM-DD local timezone representation.
 * @param {Date} date - Date object to format.
 * @returns {string} Formatted date string (YYYY-MM-DD).
 */
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string into a UTC Date object to avoid timezone shifting.
 * @param {string} dateStr - Date string to parse.
 * @returns {Date} UTC Date object.
 */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Calculates absolute day difference between two Date objects.
 * @param {Date} date1 - First date.
 * @param {Date} date2 - Second date.
 * @returns {number} Absolute difference in days.
 */
function dayDiff(date1, date2) {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = {
  formatLocalDate,
  parseLocalDate,
  dayDiff
};
