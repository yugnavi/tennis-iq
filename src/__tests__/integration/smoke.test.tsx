import { describe, expect, it } from 'vitest';
import { TRACKS } from '../../types';

describe('scaffold', () => {
  it('has three tracks', () => {
    expect(TRACKS).toHaveLength(3);
  });
});
