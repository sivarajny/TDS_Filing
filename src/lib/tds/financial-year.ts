/** Indian financial year runs 1 Apr - 31 Mar; the assessment year follows it. */
export function getFinancialYear(dateStr: string): { fy: string; ay: string } {
  const [year, month] = dateStr.split("-").map(Number);
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  return {
    fy: `${fyStartYear}-${String(fyEndYear).slice(-2)}`,
    ay: `${fyEndYear}-${String(fyEndYear + 1).slice(-2)}`,
  };
}
