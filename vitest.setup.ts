// Shared setup for Vitest tests — runs once before each test file.
// Adds @testing-library/jest-dom matchers (toBeInTheDocument, toHaveClass, …)
// to Vitest's expect.

import '@testing-library/jest-dom/vitest'
