import type { MatchRoom } from './room';
export interface Env {
  MATCHES: DurableObjectNamespace<MatchRoom>;
  DB?: D1Database;
  ASSETS?: R2Bucket;
  ENVIRONMENT: 'development' | 'preview' | 'production';
  PUBLIC_ORIGIN: string;
  RELEASE: string;
  SOURCE_SHA?: string;
  PLATPHORM_API_KEY?: string;
}
