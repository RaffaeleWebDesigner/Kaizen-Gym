import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { KaizenDB } from '../db';
import { SyncEngine } from './engine';
import { MemoryRemote } from './remote';

let n = 0;
const device = () => new KaizenDB('test-' + ++n);
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/** Telefono con dati "veri" come quelli di Raffa: id piccoli dall'autoincremento della v3. */
async function phoneWithData() {
  const db = device();
  await db.settings.bulkPut([{ key: 'seeded', value: true }, { key: 'v3done', value: true }, { key: 'heightCm', value: 172 }]);
  await db.exercises.bulkAdd([{ id: 1, name: 'Panca' } as any, { id: 2, name: 'Lat machine' } as any]);
  await db.templates.add({ id: 1, code: 'A', name: 'Seduta A', rows: [] });
  for (let i = 1; i <= 4; i++) await db.sessions.add({ id: i, date: `2026-11-1${i + 5}`, kind: 'A', status: 'done', exercises: [] } as any);
  await db.measurements.bulkAdd([{ id: 1, date: '2026-11-16', weight: 59.1 }, { id: 2, date: '2026-11-25', weight: 59.6 }]);
  await db.photos.add({ date: '2026-11-16', pose: 'front', data: new ArrayBuffer(8), mime: 'image/jpeg', width: 1, height: 1, createdAt: 1 });
  return db;
}

/** PC appena aperto: solo i dati iniziali inseriti dall'app. */
async function freshPC() {
  const db = device();
  await db.settings.put({ key: 'seeded', value: true });
  await db.exercises.add({ name: 'Panca' } as any);
  await db.templates.add({ code: 'A', name: 'Seduta A', rows: [] });
  await db.sessions.add({ date: '2026-11-16', kind: 'A', status: 'done', exercises: [] } as any);
  await db.measurements.add({ date: '2026-11-16', weight: 59.1 });
  return db;
}

async function dump(db: KaizenDB) {
  return {
    sessions: (await db.sessions.toArray()).map((s) => s.date).sort(),
    measurements: (await db.measurements.toArray()).length,
    exercises: (await db.exercises.toArray()).map((e) => e.name).sort(),
    templates: (await db.templates.toArray()).map((t) => t.code),
  };
}

describe('coda delle modifiche', () => {
  it('ogni scrittura finisce nella coda, nella stessa transazione', async () => {
    const db = device();
    const id = await db.sessions.add({ date: '2026-11-27', kind: 'A', status: 'in_progress', exercises: [] } as any);
    expect(id).toBeGreaterThan(1e15); // id unico, non più 1, 2, 3…
    await db.sessions.update(id, { notes: 'ok' });
    await db.settings.put({ key: 'heightCm', value: 172 });
    await db.measurements.add({ date: '2026-11-27', weight: 60 });
    await db.measurements.where('date').equals('2026-11-27').delete();
    await db.photos.add({ date: '2026-11-27', pose: 'front', data: new ArrayBuffer(1), mime: 'image/jpeg', width: 1, height: 1, createdAt: 1 });
    const q = await db.outbox.toArray();
    expect(q.map((e) => e.tbl).sort()).toEqual(['measurements', 'sessions', 'settings']); // le foto no
  });

  it('i successi automatici hanno lo stesso id su ogni dispositivo', async () => {
    const a = device();
    const b = device();
    const s = { date: '2026-11-27', title: 'Record', category: 'palestra', source: 'pr', autoKey: 'pr:1:5', createdAt: 1 } as const;
    expect(await a.successes.add({ ...s })).toBe(await b.successes.add({ ...s }));
  });
});

describe('prima sincronizzazione', () => {
  it('iPhone con dati e cloud vuoto: carica tutto e non cancella niente', async () => {
    const remote = new MemoryRemote();
    const phone = await phoneWithData();
    const before = await dump(phone);
    const plan = await new SyncEngine(phone, remote).firstSync('raffa');
    expect(plan.kind).toBe('upload');
    expect(await dump(phone)).toEqual(before);
    expect(await phone.photos.count()).toBe(1);
    expect(remote.live().filter((r) => r.tbl === 'sessions')).toHaveLength(4);
    expect(remote.live().some((r) => r.tbl === 'photos')).toBe(false);
    expect(await phone.outbox.count()).toBe(0);
  });

  it('PC appena aperto: prende i dati del cloud e scarta solo i dati iniziali', async () => {
    const remote = new MemoryRemote();
    const phone = await phoneWithData();
    await new SyncEngine(phone, remote).firstSync('raffa');
    const pc = await freshPC();
    const plan = await new SyncEngine(pc, remote).firstSync('raffa');
    expect(plan.kind).toBe('download');
    expect(await dump(pc)).toEqual(await dump(phone));
    expect(await pc.outbox.count()).toBe(0);
  });

  it('account nuovo (cloud vuoto) su un dispositivo con i soli dati iniziali: chiede un archivio vuoto, non carica niente', async () => {
    const remote = new MemoryRemote();
    const pc = await freshPC();
    expect((await new SyncEngine(pc, remote).firstSync('amico')).kind).toBe('fresh');
    expect(remote.rows.size).toBe(0);
  });

  it('archivio vuoto di un account nuovo: carica solo il catalogo, nessuna seduta di altri', async () => {
    const remote = new MemoryRemote();
    const db = device();
    await db.settings.bulkPut([{ key: 'seeded', value: true }, { key: 'freshAccount', value: true }]);
    await db.exercises.add({ name: 'Panca' } as any);
    expect((await new SyncEngine(db, remote).firstSync('amico')).kind).toBe('upload');
    expect(remote.live().filter((r) => r.tbl === 'sessions')).toHaveLength(0);
    expect(remote.live().filter((r) => r.tbl === 'exercises')).toHaveLength(1);
  });

  it('ricomincia da zero: cancella i dati dell’account qui, nel cloud e sull’altro dispositivo', async () => {
    const remote = new MemoryRemote();
    const a = await phoneWithData();
    const ea = new SyncEngine(a, remote);
    await ea.firstSync('prova');
    const b = await freshPC();
    const eb = new SyncEngine(b, remote);
    await eb.firstSync('prova');
    expect(await b.sessions.count()).toBe(4);
    await ea.wipeLocal();
    await a.settings.bulkPut([{ key: 'seeded', value: true }, { key: 'freshAccount', value: true }]);
    await a.exercises.add({ name: 'Panca' } as any);
    await ea.firstSync('prova', undefined, 'replaceCloud');
    await eb.sync();
    expect(await a.sessions.count()).toBe(0);
    expect(await b.sessions.count()).toBe(0);
    expect(await b.measurements.count()).toBe(0);
    expect(await a.photos.count()).toBe(1);
    expect(remote.live().filter((r) => r.tbl === 'sessions')).toHaveLength(0);
  });

  it('dati veri su entrambi: chiede, e senza risposta non tocca niente', async () => {
    const remote = new MemoryRemote();
    const phone = await phoneWithData();
    await new SyncEngine(phone, remote).firstSync('raffa');
    const other = await phoneWithData();
    await other.sessions.add({ date: '2026-11-26', kind: 'B', status: 'done', exercises: [] } as any);
    const before = await dump(other);
    const plan = await new SyncEngine(other, remote).firstSync('raffa');
    expect(plan.kind).toBe('ask');
    expect(await dump(other)).toEqual(before);
    expect(remote.live().filter((r) => r.tbl === 'sessions')).toHaveLength(4);
    // sceglie i dati del cloud
    await new SyncEngine(other, remote).firstSync('raffa', 'cloud');
    expect(await dump(other)).toEqual(await dump(phone));
  });

  it('un altro account sullo stesso dispositivo: chiede sempre', async () => {
    const remote = new MemoryRemote();
    const phone = await phoneWithData();
    await new SyncEngine(phone, remote).firstSync('raffa');
    const plan = await new SyncEngine(phone, new MemoryRemote()).firstSync('amico');
    expect(plan.kind).toBe('ask');
  });
});

describe('sincronizzazione normale', () => {
  async function pair() {
    const remote = new MemoryRemote();
    const phone = await phoneWithData();
    const pc = await freshPC();
    const a = new SyncEngine(phone, remote);
    const b = new SyncEngine(pc, remote);
    await a.firstSync('raffa');
    await b.firstSync('raffa');
    return { remote, phone, pc, a, b };
  }

  it('una seduta fatta sull’iPhone arriva sul PC, e una misura dal PC arriva sull’iPhone', async () => {
    const { phone, pc, a, b } = await pair();
    const sid = await phone.sessions.add({ date: '2026-11-27', kind: 'B', status: 'done', exercises: [] } as any);
    await a.sync();
    await pc.measurements.add({ date: '2026-11-27', weight: 60 });
    const r = await b.sync();
    expect(r.received).toBe(1);
    expect((await pc.sessions.get(sid))?.kind).toBe('B');
    await a.sync();
    expect(await phone.measurements.count()).toBe(3);
    expect(await dump(phone)).toEqual(await dump(pc));
  });

  it('stessa riga modificata su due dispositivi: vince la modifica più recente', async () => {
    const { phone, pc, a, b } = await pair();
    await phone.sessions.update(4, { notes: 'iPhone' });
    await wait();
    await pc.sessions.update(4, { notes: 'PC, dopo' });
    await a.sync();
    await b.sync(); // il PC è più recente: tiene la sua e la invia
    await a.sync();
    expect((await phone.sessions.get(4))?.notes).toBe('PC, dopo');
    expect((await pc.sessions.get(4))?.notes).toBe('PC, dopo');
  });

  it('la modifica più vecchia non sovrascrive quella nuova anche se arriva dopo', async () => {
    const { phone, pc, a, b } = await pair();
    await pc.sessions.update(3, { notes: 'vecchia' });
    await wait();
    await phone.sessions.update(3, { notes: 'nuova' });
    await a.sync();
    await b.sync();
    await a.sync();
    expect((await pc.sessions.get(3))?.notes).toBe('nuova');
    expect((await phone.sessions.get(3))?.notes).toBe('nuova');
  });

  it('le cancellazioni arrivano sull’altro dispositivo', async () => {
    const { phone, pc, a, b } = await pair();
    await phone.measurements.delete(2);
    await a.sync();
    await b.sync();
    expect(await pc.measurements.get(2)).toBeUndefined();
  });

  it('senza rete le modifiche restano in coda e partono dopo', async () => {
    const { remote, phone, pc, a, b } = await pair();
    await phone.sessions.update(1, { notes: 'offline' });
    remote.failNext = true;
    await expect(a.sync()).rejects.toThrow();
    expect(await phone.outbox.count()).toBe(1);
    await a.sync();
    expect(await phone.outbox.count()).toBe(0);
    await b.sync();
    expect((await pc.sessions.get(1))?.notes).toBe('offline');
  });

  it('ricevere dal cloud non rimette le righe in coda (niente giri infiniti)', async () => {
    const { phone, pc, a, b } = await pair();
    await phone.sessions.update(2, { notes: 'x' });
    await a.sync();
    await b.sync();
    expect(await pc.outbox.count()).toBe(0);
    expect((await b.sync()).received).toBe(0);
  });

  it('le foto restano solo sul telefono', async () => {
    const { pc, phone } = await pair();
    expect(await phone.photos.count()).toBe(1);
    expect(await pc.photos.count()).toBe(0);
  });
});

describe('aggiornamento dalla v3', () => {
  it('apre il database v3 del telefono senza toccare i dati e senza mettere niente in coda', async () => {
    const Dexie = (await import('dexie')).default;
    const old = new Dexie('test-v3');
    old.version(1).stores({ settings: 'key', exercises: '++id, name, group', templates: '++id, &code', sessions: '++id, date, kind, status', dayMarks: '++id, date, type', matches: '++id, date', measurements: '++id, date', reviews: '++id, type, periodStart' });
    old.version(2).stores({ photos: '++id, date, pose', challenges: '++id', challengeAttempts: '++id, challengeId, date, status', successes: '++id, date, autoKey, source', rankHistory: '++id, date, key' });
    old.version(3).stores({ goals: '++id, status, kind' });
    await old.table('sessions').bulkAdd([{ date: '2026-11-16', kind: 'A', status: 'done', exercises: [{ name: 'Panca' }] }, { date: '2026-11-24', kind: 'B', status: 'done', exercises: [] }]);
    await old.table('goals').add({ kind: 'streak', title: '4 settimane', status: 'active', target: 4 });
    await old.table('photos').add({ date: '2026-11-16', pose: 'front', data: new ArrayBuffer(4) });
    await old.table('settings').put({ key: 'v3done', value: true });
    const before = await old.table('sessions').toArray();
    old.close();

    const db = new KaizenDB('test-v3');
    expect(await db.sessions.toArray()).toEqual(before);
    expect(await db.goals.count()).toBe(1);
    expect(await db.photos.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
    expect(db.verno).toBe(4);
    // dopo l'aggiornamento le righe nuove hanno id unici, quelle vecchie restano 1, 2
    const id = await db.sessions.add({ date: '2026-11-27', kind: 'C', status: 'done', exercises: [] } as any);
    expect((await db.sessions.toArray()).map((s) => s.id)).toEqual([1, 2, id]);
  });
});
