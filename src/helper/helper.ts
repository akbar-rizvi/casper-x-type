
export const  isIndianLocation=(lat: number, lon: number): boolean=> {
  return lat >= 6.55 && lat <= 35.67 && lon >= 68.11 && lon <= 97.4;
}