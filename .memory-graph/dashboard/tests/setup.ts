// Registers jest-dom's DOM matchers (toBeInTheDocument, toHaveAttribute, …) for
// every test file. Loaded via `setupFiles` in vitest.config.ts rather than
// imported per-file, so a new component test gets them without ceremony.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library normally registers its own afterEach(cleanup), but only when
// a global `afterEach` exists. This config runs with `globals: false`, so that
// registration silently no-ops and rendered trees pile up in one document —
// every getByTestId after the first render then throws "Found multiple
// elements". Registering it here is what keeps component tests isolated.
afterEach(() => {
  cleanup();
});
