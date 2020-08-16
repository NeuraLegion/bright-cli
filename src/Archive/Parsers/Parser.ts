export interface File {
  content: string;
  filename: string;
}

export interface Parser {
  parse(path: string): Promise<File>;
}
