/* Truck sold / ownership change. Pure. */

/** "Sold my truck", "traded it in", "don't have that truck anymore". */
const TRUCK_SOLD = /\b(?:sold|traded(?:\s+(?:it|her|him))?\s+in|got rid of|totaled|totalled|wrecked)\b[\w\s']{0,30}\b(?:truck|duramax|cummins|power\s?stroke|ram|ford|chevy|it)\b|\b(?:truck|it)\b[\w\s']{0,15}\b(?:is|was|got)\s+(?:sold|totaled|totalled)\b|\bno longer (?:have|own)\b|\bdon'?t (?:have|own) (?:that|the|my) truck\b/i;
export const SOLD_TAG = 'truck-sold';

export function isTruckSoldMessage(body: string): boolean {
  return TRUCK_SOLD.test(body.slice(0, 500));
}
