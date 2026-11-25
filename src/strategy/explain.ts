import type { PlayerAction } from '../engine/types';
import type { ChartLookup } from './lookup';

export const ACTION_LABEL: Record<PlayerAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

export const INSURANCE_EXPLANATION =
  'Insurance is a side bet that loses over time. Basic strategy never takes it.';

const WEAK = ['2', '3', '4', '5', '6'];

export function upcardName(up: string): string {
  return up === 'A' ? 'an Ace' : up === '8' ? 'an 8' : `a ${up}`;
}

export function handName(l: Pick<ChartLookup, 'kind' | 'total' | 'pairRank'>): string {
  if (l.kind === 'pair') return `${l.pairRank},${l.pairRank}`;
  return `${l.kind === 'soft' ? 'Soft' : 'Hard'} ${l.total}`;
}

/** Plain-language reason for a basic-strategy play (section 3.4). */
export function explain(
  l: Pick<ChartLookup, 'kind' | 'total' | 'pairRank' | 'upcard' | 'code'>,
  action: PlayerAction,
): string {
  const { kind, total, upcard: up, code } = l;
  const weak = WEAK.includes(up);
  const vs = upcardName(up);

  // The chart wanted something that isn't allowed here.
  if ((code === 'D' || code === 'Ds') && action !== 'double')
    return `The chart says double here, but you can't double now, so ${action === 'hit' ? 'hit' : 'stand'} instead.`;
  if (code.startsWith('R') && action !== 'surrender')
    return `Surrender would be best, but it isn't available now, so ${ACTION_LABEL[action].toLowerCase()} instead.`;

  if (action === 'surrender') {
    const hand = kind === 'pair' ? '8,8' : `Hard ${total}`;
    return `${hand} against ${vs} loses more than half the time. Giving up half the bet loses less in the long run.`;
  }

  if (kind === 'pair') {
    const r = l.pairRank;
    if (r === 'A' && action === 'split') return 'Always split Aces — each hand starts with 11.';
    if (r === '8' && action === 'split')
      return '16 is the worst total; two hands starting with 8 are much better.';
    if (r === '10') return '20 is already a strong hand. Never split tens.';
    if (r === '5')
      return 'Never split 5s — play them as a hard 10, which is a great total to double on.';
    if (r === '9' && action === 'stand')
      return up === '7'
        ? '18 already beats the dealer’s likely 17, so keep it.'
        : '18 is a good total against a strong up card; splitting would start two weaker hands.';
    if (r === '9') return `Two hands starting with 9 make more money than one 18 against ${vs}.`;
    if (r === '4' && action === 'split')
      return 'Against a 5 or 6, split 4s so you can double on the new hands.';
    if (action === 'split')
      return weak || up === '7'
        ? `The dealer’s ${up} is weak, so two hands make more money than one poor total.`
        : `Two hands starting with ${r} do better than one poor total here.`;
    if (action === 'hit')
      return `Splitting ${r}s against ${vs} just makes two weak hands. Hit instead.`;
  }

  if (kind === 'soft') {
    if (action === 'double')
      return `Soft ${total} can't bust with one card and the dealer's ${up} is weak — double to get more money on the table.`;
    if (action === 'hit' && total === 18)
      return "Soft 18 loses to the dealer's strong cards; you can hit without risk of busting.";
    if (action === 'hit')
      return `Soft ${total} can't bust with one more card and is too weak to stand on.`;
    if (action === 'stand' && total === 18) return `Soft 18 is good enough against ${vs}; stand.`;
    if (action === 'stand') return `Soft ${total} is a strong hand; stand.`;
  }

  if (kind === 'hard' || kind === 'pair') {
    if (action === 'double' && total === 11)
      return 'Double against every up card except an Ace — one more card gives you a strong chance at 21.';
    if (action === 'double')
      return `One more card on ${total} gives a strong chance at 19–21, and the dealer's ${up} is weak enough to double.`;
    if (action === 'hit' && total <= 11) return `You can't bust with one card on ${total}, so hit.`;
    if (total === 12 && action === 'hit' && (up === '2' || up === '3'))
      return '12 against a 2 or 3 is the exception: the dealer busts less often, so hit.';
    if (total >= 12 && total <= 16 && action === 'stand' && weak)
      return "The dealer is likely to bust with a weak up card, so don't risk busting yourself.";
    if (total >= 12 && total <= 16 && action === 'hit')
      return 'The dealer probably has 17 or more, so standing loses more often than hitting.';
    if (total >= 17 && action === 'stand')
      return `${total} is too likely to bust if you hit; stand.`;
  }

  return `Basic strategy says ${ACTION_LABEL[action]} on ${handName(l)} vs ${vs}.`;
}
