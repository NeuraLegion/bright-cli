export const toArray = <T>(enumeration: any): T[] =>
  [...Object.values(enumeration)] as T[];
