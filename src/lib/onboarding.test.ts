import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { applyOnboarding, buildPlan, defaultInventory } from './onboarding';

const names = (t: { rows: { name: string }[] }) => t.rows.map((r) => r.name);

describe('buildPlan', () => {
  it('palestra, esperto: bilanciere e macchine', () => {
    const [a, b, c] = buildPlan({ goal: 'forza', experience: 'esperto', place: 'palestra', equipment: [] });
    expect(names(a)).toEqual(['Squat con bilanciere', 'Panca piana con bilanciere', 'Lat machine', 'Shoulder press con manubri da seduto', 'Plank']);
    expect(names(b)[0]).toBe('Trazioni alla sbarra');
    expect(names(c)[0]).toBe('Stacco da terra');
    expect(a.rows[0]).toMatchObject({ sets: 3, repMin: 5, repMax: 8 });
  });

  it('principiante: niente esercizi avanzati, 2 serie', () => {
    const plan = buildPlan({ goal: 'salute', experience: 'principiante', place: 'palestra', equipment: [] });
    const all = plan.flatMap(names);
    for (const adv of ['Stacco da terra', 'Trazioni alla sbarra', 'Dip alle parallele', 'Military press con bilanciere']) expect(all).not.toContain(adv);
    expect(plan[0].rows.every((r) => r.sets === 2)).toBe(true);
  });

  it('casa senza attrezzi: tutto a corpo libero, braccia saltate', () => {
    const plan = buildPlan({ goal: 'dimagrire', experience: 'intermedio', place: 'casa', equipment: [] });
    expect(names(plan[0])).toEqual(['Squat a corpo libero', 'Piegamenti', 'Rematore inverso', 'Pike push-up', 'Plank']);
    expect(plan[1].rows.some((r) => r.name.includes('Curl'))).toBe(false);
  });

  it('casa con manubri e sbarra', () => {
    const plan = buildPlan({ goal: 'massa', experience: 'intermedio', place: 'casa', equipment: ['manubri', 'sbarra'] });
    expect(names(plan[0])[0]).toBe('Goblet squat');
    expect(names(plan[1])[0]).toBe('Trazioni alla sbarra');
    expect(names(plan[1])).toContain('Curl con manubri');
  });

  it('nessun esercizio ripetuto nella stessa seduta', () => {
    for (const exp of ['principiante', 'intermedio', 'esperto'] as const)
      for (const place of ['palestra', 'casa'] as const)
        for (const t of buildPlan({ goal: 'massa', experience: exp, place, equipment: [] })) expect(new Set(names(t)).size).toBe(t.rows.length);
  });
});

describe('applyOnboarding su un archivio nuovo', () => {
  it('ogni esercizio delle sedute esiste nel catalogo, macchine e unità aggiornate', async () => {
    const { db } = await import('../db');
    const { seedIfEmpty } = await import('../seed');
    const { ensureV2, ensureV3, ensureMachines } = await import('../migrations');
    await seedIfEmpty(true); await ensureV2(); await ensureV3(); await ensureMachines();
    for (const place of ['palestra', 'casa'] as const) {
      await applyOnboarding({ goal: 'massa', experience: 'esperto', place, equipment: place === 'casa' ? ['manubri'] : [], unit: 'lb',
        machineStep: { value: 10, unit: 'lb' }, days: 4, program: 'ppl', gymDays: [0, 2, 4, 5], safetyFlags: [], acceptedAt: 1 });
      const ex = new Map((await db.exercises.toArray()).map((e) => [e.id!, e]));
      const tpls = await db.templates.toArray();
      expect(tpls.map((t) => t.code).sort()).toEqual(['A', 'B', 'C', 'MIN']);
      for (const t of tpls) for (const r of t.rows) expect(ex.has(r.exerciseId)).toBe(true);
      const lat = [...ex.values()].find((e) => e.name === 'Lat machine')!;
      expect(lat).toMatchObject({ unit: 'lb', stackStep: 10 });
      expect([...ex.values()].find((e) => e.name === 'Goblet squat')!.unit).toBe('lb');
    }
    expect((await db.settings.get('weeklyGoal'))?.value).toBe(4);
    expect((await db.settings.get('onboarded'))?.value).toBe(true);
  });
});

describe('defaultInventory', () => {
  it('palestra in kg: dischi da 20 e bilanciere olimpico', () => {
    const inv = defaultInventory({ place: 'palestra', equipment: [], unit: 'kg' });
    expect(inv.plates[0].weight).toBe(20);
    expect(inv.bars[0].weight).toBe(20);
  });
  it('casa senza bilanciere: nessun bilanciere', () => {
    expect(defaultInventory({ place: 'casa', equipment: ['manubri'], unit: 'kg' }).bars).toEqual([]);
  });
});

describe('cambio di attrezzatura dopo il benvenuto', () => {
  it('rifà le sedute con la nuova attrezzatura', async () => {
    const { db } = await import('../db');
    const { updateProfile } = await import('./onboarding');
    const base = { goal: 'massa', experience: 'intermedio', place: 'casa', equipment: [], unit: 'kg', machineStep: { value: 5, unit: 'kg' },
      days: 3, program: 'fullbody', gymDays: [], safetyFlags: [], acceptedAt: 1 } as import('./onboarding').Profile;
    await updateProfile({ ...base, equipment: [] }, true);
    const name = async () => { const t = await db.templates.where('code').equals('A').first(); return (await db.exercises.get(t!.rows[0].exerciseId))!.name; };
    expect(await name()).toBe('Squat a corpo libero');
    await updateProfile({ ...base, equipment: ['manubri'] }, true);
    expect(await name()).toBe('Goblet squat');
    await updateProfile({ ...base, place: 'palestra' }, false);
    expect(await name()).toBe('Goblet squat'); // senza "rifai" le sedute restano
  });
});
