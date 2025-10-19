import { ContextInsight } from '../../../types';

const isNumeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const formatPercent = (value: number | null | undefined, digits = 1) =>
  isNumeric(value) ? `${(value * 100).toFixed(digits)}%` : '—';

export const formatNumber = (value: number | null | undefined) =>
  isNumeric(value) ? value.toLocaleString('de-DE') : '—';

export const formatSigned = (value: number | null | undefined, digits = 2) =>
  isNumeric(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(digits)}` : '—';

export const formatTokenDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);

export const describeTokenAdvantage = (delta: number) => {
  if (delta > 0) return 'zugunsten des Spielers';
  if (delta < 0) return 'zugunsten der KI';
  return 'ohne Token-Vorsprung';
};

export const formatInterval = (lower: number, upper: number) =>
  `${(lower * 100).toFixed(1)}–${(upper * 100).toFixed(1)}%`;

export const formatEvidence = (score: number) => `${(score * 100).toFixed(1)}%`;

export const formatProfilePercent = (value: number) => `${Math.round(value * 100)}%`;

export const buildContextBadges = (context: ContextInsight) => {
  const badges: { label: string; color: string }[] = [];
  if (context.observations < 10) badges.push({ label: 'fragil', color: 'bg-amber-600' });
  if (context.wilsonLower < 0.5) badges.push({ label: 'unsicher', color: 'bg-red-700' });
  if (context.observations >= 100) badges.push({ label: 'stabil', color: 'bg-emerald-700' });
  return badges;
};
