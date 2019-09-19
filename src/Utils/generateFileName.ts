import { basename, extname, resolve } from 'path';

export const generatorFileNameFactory: () => (
  filePath: string
) => string = () => {
  let counter: number = 1;
  return (filePath: string) => {
    const ext: string = extname(filePath);
    const name: string = basename(filePath, ext);
    if (counter === 1) {
      counter++;
      return filePath;
    }
    return resolve(filePath, '..', `${name}_${counter++}${ext}`);
  };
};

export const globalFileNameGenerator: (
  filePath: string
) => string = generatorFileNameFactory();
