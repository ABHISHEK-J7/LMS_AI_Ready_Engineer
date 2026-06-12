/**
 * Platform-wide defaults. All of these are admin-configurable at runtime
 * (stored in a Settings document); these are the seed/fallback values.
 */

/** Minimum % score to pass a final assessment and unlock the next module. */
export const DEFAULT_PASSING_SCORE = 70;

/** Minimum overall attendance % required for certification eligibility. */
export const DEFAULT_MIN_ATTENDANCE = 75;

/** Practice tests per module (Practice Test 1..5). */
export const PRACTICE_TESTS_PER_MODULE = 5;

/** Prompt-evaluation engine scores out of this maximum. */
export const PROMPT_SCORE_MAX = 100;

/** JWT access-token lifetime (string accepted by `jsonwebtoken`). */
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '7d';

/** Whether public student self-registration is allowed (admin-configurable). */
export const DEFAULT_ALLOW_SELF_REGISTRATION = false;
