export interface File {
  content: string;
  filename: string;
  contentType: string;
}

export interface Parser {
  parse(path: string): Promise<File>;
}
