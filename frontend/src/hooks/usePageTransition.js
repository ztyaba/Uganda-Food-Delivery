import { useMemo } from 'react';

export function usePageTransition() {
  return useMemo(
    () => ({
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -16 },
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }),
    []
  );
}
