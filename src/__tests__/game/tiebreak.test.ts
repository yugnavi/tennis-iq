import { applyPoint, INITIAL_TIEBREAK, tiebreakServer, tiebreakWinner, type TiebreakScore } from '../../game/tiebreak';

describe('tiebreakWinner', () => {
  it.each([
    [0, 0],
    [6, 6],
    [7, 6],
    [6, 7],
    [6, 5],
    [8, 7],
  ])('no winner at %i–%i', (p, o) => {
    expect(tiebreakWinner(p, o)).toBeNull();
  });

  it.each([
    [7, 0, 'player'],
    [7, 5, 'player'],
    [8, 6, 'player'],
    [10, 8, 'player'],
    [5, 7, 'opponent'],
    [6, 8, 'opponent'],
  ] as const)('%i–%i is won by %s', (p, o, w) => {
    expect(tiebreakWinner(p, o)).toBe(w);
  });
});

describe('tiebreakServer', () => {
  it('player serves point 1, then serve alternates every two points', () => {
    const seq = Array.from({ length: 9 }, (_, i) => tiebreakServer(i + 1));
    expect(seq).toEqual(['player', 'opponent', 'opponent', 'player', 'player', 'opponent', 'opponent', 'player', 'player']);
  });
});

describe('applyPoint reducer', () => {
  const play = (winners: ('player' | 'opponent')[]): TiebreakScore =>
    winners.reduce((s, w) => applyPoint(s, w), INITIAL_TIEBREAK);

  it('reaches 7–0 and declares the player the winner', () => {
    const s = play(Array(7).fill('player'));
    expect(s).toEqual({ player: 7, opponent: 0, winner: 'player' });
  });

  it('continues past 6–6 until a 2-point lead', () => {
    let s = play([...Array(6).fill('player'), ...Array(6).fill('opponent')]);
    expect(s.winner).toBeNull();
    s = applyPoint(s, 'player');
    expect(s).toEqual({ player: 7, opponent: 6, winner: null });
    s = applyPoint(s, 'opponent');
    s = applyPoint(s, 'opponent');
    expect(s.winner).toBeNull();
    s = applyPoint(s, 'opponent');
    expect(s).toEqual({ player: 7, opponent: 9, winner: 'opponent' });
  });

  it('refuses to add points once the tie-break is decided', () => {
    const won = play(Array(7).fill('player'));
    expect(applyPoint(won, 'opponent')).toBe(won);
    expect(applyPoint(won, 'player')).toBe(won);
    // Even a state whose winner field was not set is protected by the score check.
    const raw = { player: 7, opponent: 5, winner: null };
    expect(applyPoint(raw, 'opponent')).toBe(raw);
  });
});
