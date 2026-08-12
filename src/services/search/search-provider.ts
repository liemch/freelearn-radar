export type SearchInput = {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  timeoutMs?: number;
};

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

export interface SearchProvider {
  search(input: SearchInput): Promise<SearchResult[]>;
}
