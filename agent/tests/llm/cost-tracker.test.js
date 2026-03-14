import { describe, it, expect, beforeEach } from '@jest/globals';
import { trackUsage, getSessionUsage, resetSessionUsage } from '../../llm/cost-tracker.js';

const pricingTable = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'GLM-4.7-FlashX': { input: 0.0001, output: 0.0004 },
};

describe('Cost Tracker', () => {
  beforeEach(() => {
    resetSessionUsage();
  });

  describe('trackUsage()', () => {
    it('should accumulate token counts', () => {
      trackUsage({ inputTokens: 100, outputTokens: 50 }, 'gpt-4o', pricingTable);
      trackUsage({ inputTokens: 200, outputTokens: 75 }, 'gpt-4o', pricingTable);

      const usage = getSessionUsage();
      expect(usage.totalInputTokens).toBe(300);
      expect(usage.totalOutputTokens).toBe(125);
      expect(usage.callCount).toBe(2);
    });

    it('should calculate cost correctly', () => {
      // 1000 input tokens at $0.0025/1K = $0.0025
      // 500 output tokens at $0.01/1K = $0.005
      // Total = $0.0075
      trackUsage({ inputTokens: 1000, outputTokens: 500 }, 'gpt-4o', pricingTable);

      const usage = getSessionUsage();
      expect(usage.totalCost).toBeCloseTo(0.0075, 6);
    });

    it('should return cost from trackUsage call', () => {
      const cost = trackUsage(
        { inputTokens: 1000, outputTokens: 1000 },
        'claude-sonnet-4-20250514',
        pricingTable
      );
      // 1000/1000 * 0.003 + 1000/1000 * 0.015 = 0.018
      expect(cost).toBeCloseTo(0.018, 6);
    });

    it('should handle unknown model with zero cost', () => {
      trackUsage({ inputTokens: 500, outputTokens: 200 }, 'unknown-model', pricingTable);

      const usage = getSessionUsage();
      expect(usage.totalInputTokens).toBe(500);
      expect(usage.totalOutputTokens).toBe(200);
      expect(usage.totalCost).toBe(0);
      expect(usage.callCount).toBe(1);
    });

    it('should handle empty pricing table', () => {
      trackUsage({ inputTokens: 100, outputTokens: 50 }, 'gpt-4o', {});

      const usage = getSessionUsage();
      expect(usage.totalCost).toBe(0);
      expect(usage.callCount).toBe(1);
    });
  });

  describe('getSessionUsage()', () => {
    it('should return a copy (not reference)', () => {
      trackUsage({ inputTokens: 100, outputTokens: 50 }, 'gpt-4o', pricingTable);

      const usage1 = getSessionUsage();
      const usage2 = getSessionUsage();
      expect(usage1).not.toBe(usage2);
      expect(usage1).toEqual(usage2);
    });

    it('should return zeros initially', () => {
      const usage = getSessionUsage();
      expect(usage).toEqual({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        callCount: 0,
      });
    });
  });

  describe('resetSessionUsage()', () => {
    it('should reset all counters to zero', () => {
      trackUsage({ inputTokens: 100, outputTokens: 50 }, 'gpt-4o', pricingTable);
      trackUsage({ inputTokens: 200, outputTokens: 75 }, 'gpt-4o', pricingTable);

      resetSessionUsage();
      const usage = getSessionUsage();
      expect(usage.totalInputTokens).toBe(0);
      expect(usage.totalOutputTokens).toBe(0);
      expect(usage.totalCost).toBe(0);
      expect(usage.callCount).toBe(0);
    });
  });

  describe('cost calculation for different models', () => {
    it('should use correct pricing for GLM model', () => {
      // 10000 input at $0.0001/1K = $0.001
      // 5000 output at $0.0004/1K = $0.002
      trackUsage({ inputTokens: 10000, outputTokens: 5000 }, 'GLM-4.7-FlashX', pricingTable);

      const usage = getSessionUsage();
      expect(usage.totalCost).toBeCloseTo(0.003, 6);
    });
  });
});
