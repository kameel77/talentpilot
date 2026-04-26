/**
 * Re-export canonical talent types from lib/gallup-data.ts
 * This file exists for backwards compatibility with existing imports.
 */
export type { GallupDomain, GallupTalent } from '@/lib/gallup-data';

export interface UserTalent {
    talentId: string;
    rank: number;
}
