declare module 'google-trends-api' {
  export interface TrendRequestOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string | string[];
    hl?: string;
    timezone?: number;
    category?: number;
    property?: string;
    granularTimeResolution?: boolean;
  }

  export function interestOverTime(options: TrendRequestOptions): Promise<string>;
  export function interestByRegion(options: TrendRequestOptions): Promise<string>;
  export function relatedQueries(options: TrendRequestOptions): Promise<string>;
  export function relatedTopics(options: TrendRequestOptions): Promise<string>;
}
