import { handTotal, isBlackjack } from './cards';
import type { Card, Hand, HandResult } from './types';

/** Result and net payout of one hand against the dealer's final cards. */
export function settleHand(hand: Hand, dealer: Card[]): { result: HandResult; payout: number } {
  const dealerBj = dealer.length === 2 && handTotal(dealer).total === 21;
  const dealerTotal = handTotal(dealer).total;
  const player = handTotal(hand.cards).total;
  const playerBj = isBlackjack(hand);

  if (hand.status === 'surrendered') return { result: 'surrender', payout: -hand.bet / 2 };
  if (player > 21) return { result: 'lose', payout: -hand.bet };
  if (playerBj && dealerBj) return { result: 'push', payout: 0 };
  if (playerBj) return { result: 'blackjack', payout: hand.bet * 1.5 };
  if (dealerBj) return { result: 'lose', payout: -hand.bet };
  if (dealerTotal > 21 || player > dealerTotal) return { result: 'win', payout: hand.bet };
  if (player === dealerTotal) return { result: 'push', payout: 0 };
  return { result: 'lose', payout: -hand.bet };
}

/** Insurance pays 2:1 when the dealer has blackjack, otherwise the bet is lost. */
export function settleInsurance(bet: number, dealerHasBlackjack: boolean): number {
  return dealerHasBlackjack ? bet * 2 : -bet;
}
