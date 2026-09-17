import { describe, expect, test } from 'vitest';
import { isTruckSoldMessage } from './truck-sold';

describe('isTruckSoldMessage', () => {
  test.each(['I sold my truck', 'sold the Duramax last month', "Traded it in for a Ram", 'the truck was totaled', "don't have that truck anymore", 'no longer own it'])('%s', (body) => {
    expect(isTruckSoldMessage(body)).toBe(true);
  });
  test.each(['See you Tuesday', 'Is the turbo sold out?', 'How much for a tune?', 'Thanks!'])('not: %s', (body) => {
    expect(isTruckSoldMessage(body)).toBe(false);
  });
});
