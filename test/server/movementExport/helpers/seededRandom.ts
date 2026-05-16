/*
 * Deterministic seeded PRNG for the `game-movement-export` feature's property tests.
 *
 * Algorithm: mulberry32
 * ---------------------
 * Mulberry32 is a 32-bit, single-state pseudo-random number generator that maps a
 * 32-bit integer state to a uniformly distributed float in [0, 1). On each call
 * the state is advanced by adding `0x6D2B79F5` and the resulting word is run
 * through a small avalanche/scramble of XOR-shifts and integer multiplies before
 * being normalized to a float by dividing by 2^32. The full update used below is:
 *
 *     state = (state + 0x6D2B79F5) | 0;
 *     let t = state;
 *     t = Math.imul(t ^ (t >>> 15), t | 1);
 *     t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
 *     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 *
 * Why mulberry32?
 * ---------------
 * - Pure and deterministic: the same seed always yields the same stream, which
 *   is exactly what the property-based specs need to reproduce a failing case
 *   from a printed seed.
 * - Tiny and dependency-free: the entire generator is a closure over a single
 *   32-bit integer, so it adds no third-party dependency to the project. The
 *   `game-movement-export` testing strategy explicitly excludes `fast-check`
 *   and similar PBT runners, so a hand-written PRNG is required.
 *   See `.kiro/specs/game-movement-export/design.md` (Testing Strategy) for the
 *   full rationale.
 * - Good enough quality at testing scale: mulberry32 passes BigCrush on the
 *   sample sizes our property specs use (>=100 iterations per property).
 * - Fast: a handful of integer operations per call, no allocations, no I/O.
 *
 * Default seed and override
 * -------------------------
 * Property specs in `test/server/movementExport/properties/*.spec.ts` default
 * the seed to `0xC0FFEE` so test runs are reproducible by default. A developer
 * can replay a specific failing seed by setting the `MOVEMENT_EXPORT_PROP_SEED`
 * environment variable, for example:
 *
 *     MOVEMENT_EXPORT_PROP_SEED=12345 npm run test
 *
 * The env override is read by each property spec, not by this module: this file
 * stays a pure function of its argument so it can be unit-tested directly.
 *
 * Purity
 * ------
 * This module performs no I/O. It does not import `fs`, `fs/promises`, `path`,
 * or any persistence module, in keeping with the feature's "no filesystem
 * coupling" rule.
 */

export function mulberry32(seed: number): () => number {
    let state = seed | 0;

    return function next(): number {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
