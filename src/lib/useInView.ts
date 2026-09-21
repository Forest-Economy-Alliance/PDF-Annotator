import { useEffect, useRef, useState } from 'react';

/** Tracks whether an element is within `rootMargin` of the viewport, flipping back to false once it leaves. */
export function useInView<T extends HTMLElement>(rootMargin = '600px 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => setInView(entries[entries.length - 1].isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
