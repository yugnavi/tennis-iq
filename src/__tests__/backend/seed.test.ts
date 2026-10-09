import { describe, expect, it } from 'vitest';
import seedSql from '../../../supabase/seed.sql?raw';
import { CHALLENGES, toPublicChallenge } from '../../data';
import { mapChallengeRow } from '../../services/rows';

const sqlString = (v: string) => `'${v.replaceAll("'", "''")}'`;

describe('real challenge content vs. server boundary', () => {
  it('every bundled challenge survives the SQL row → PublicChallenge mapping unchanged', () => {
    expect(CHALLENGES).toHaveLength(30);
    for (const c of CHALLENGES) {
      const row = {
        id: c.id,
        track: c.track,
        kind: c.kind,
        difficulty: c.difficulty,
        prompt: c.prompt,
        options: c.options,
        court: c.court ?? null,
        source_name: c.sourceName,
        source_url: c.sourceUrl,
      };
      expect(mapChallengeRow(row)).toEqual(toPublicChallenge(c));
    }
  });

  it('supabase/seed.sql is in sync with src/data/challenges.json (run `npm run seed:generate`)', () => {
    expect(seedSql).toContain(`-- ${CHALLENGES.length} approved challenges.`);
    for (const c of CHALLENGES) {
      const prefix = [c.id, c.track, c.kind].map(sqlString).join(', ') + `, ${c.difficulty}, ${sqlString(c.prompt)}`;
      expect(seedSql, `${c.id} row out of date`).toContain(`(${prefix}`);
      expect(seedSql, `${c.id} answer/explanation out of date`).toContain(`${sqlString(c.correctOptionId)}, ${sqlString(c.explanation)}`);
    }
  });
});
