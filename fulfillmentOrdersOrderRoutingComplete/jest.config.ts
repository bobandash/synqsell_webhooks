/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
    transform: {
        '^.+\\.ts?$': 'ts-jest',
    },
    clearMocks: true,
    coverageProvider: 'v8',
    testMatch: ['**/tests/functional.test.ts'],
};
