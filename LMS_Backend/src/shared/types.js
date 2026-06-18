/**
 * Shared domain shapes, expressed as JSDoc typedefs so editors still get
 * autocomplete/hints across the JS codebase. No runtime exports — these are
 * documentation only. The API contract they describe is enforced at runtime by
 * the backend's Zod validators and Mongoose schemas.
 *
 * @typedef {Object} UserDTO
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} role
 * @property {string} status
 * @property {string} [phone]
 * @property {string} [avatarUrl]
 * @property {string} [batch]
 * @property {string[]} [assignedModules]
 * @property {string[]} [assignedBatches]
 * @property {string} [lastLoginAt]
 * @property {string} createdAt
 * @property {string} updatedAt
 *
 * @typedef {Object} AuthTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 *
 * @typedef {Object} LoginResponse
 * @property {UserDTO} user
 * @property {AuthTokens} tokens
 *
 * @typedef {Object} EvaluationResult
 * @property {number} score        0..100
 * @property {boolean} passed
 * @property {string} summary
 * @property {string[]} suggestions
 * @property {Record<string, number>} breakdown
 *
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {*} [data]
 * @property {{ code: string, message: string, details?: * }} [error]
 *
 * @typedef {Object} Paginated
 * @property {*[]} items
 * @property {number} page
 * @property {number} pageSize
 * @property {number} total
 */

export {};
