export const omit = <T, K extends keyof T>(
  data: T
): Omit<T, undefined | null> =>
  (Object.entries(data) as [K, T[K]][]).reduce(
    (acc: Omit<T, undefined | null>, [k, v]: [K, T[K]]) =>
      v == null ? acc : { ...acc, [k]: v },
    {} as Omit<T, undefined | null>
  );
