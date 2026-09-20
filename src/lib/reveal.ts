type Reveal = (element: Element, index: number) => Animation[];

/** Observa uma vez e cuida da preferência de movimento e da limpeza dos efeitos. */
export function observeReveal(
  elements: Iterable<Element>,
  reveal: Reveal,
  threshold = 0.12,
): () => void {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set<Animation>();
  const cancel = () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
  };
  const onPreferenceChange = () => {
    if (preference.matches) cancel();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, index) => {
          if (!preference.matches) {
            for (const animation of reveal(entry.target, index)) {
              animations.add(animation);
              // Remove tanto efeitos concluídos quanto cancelados, sem reter referências.
              animation.finished.then(
                () => animations.delete(animation),
                () => animations.delete(animation),
              );
            }
          }
          observer.unobserve(entry.target);
        });
    },
    { threshold },
  );
  for (const element of elements) observer.observe(element);
  preference.addEventListener('change', onPreferenceChange);
  return () => {
    observer.disconnect();
    preference.removeEventListener('change', onPreferenceChange);
    cancel();
  };
}
