export type GallupDomain = 'executing' | 'influencing' | 'relationship' | 'strategic';

export interface GallupTalent {
    id: string;
    name: string;
    namePl: string;
    domain: GallupDomain;
    description: string;
    descriptionPl: string;
}

export interface UserTalent {
    talentId: string;
    rank: number;
}
