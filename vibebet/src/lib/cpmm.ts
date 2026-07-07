// Ensure CPMM math is synchronized with database logic
export const calculateCPMMPrice = (reserveYes: number, reserveNo: number): number => {
  const k = reserveYes * reserveNo;
  return reserveYes / (reserveYes + reserveNo);
};