import { GallupDomain } from '@/types/talent';
export type DomainType = GallupDomain;
import { DOMAIN_LABELS } from '@/data/gallupTalents';
import { cn } from '@/lib/utils';

interface DomainBadgeProps {
    domain: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

export function DomainBadge({ domain, size = 'md', showLabel = true, className }: DomainBadgeProps) {
    // console.log('[DomainBadge] Rendering domain:', domain);

    if (!domain) return null;

    const label = DOMAIN_LABELS[domain as GallupDomain]?.pl || domain;

    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider",
            domain === 'executing' && "bg-domain-executing-light text-domain-executing border-domain-executing/30",
            domain === 'influencing' && "bg-domain-influencing-light text-domain-influencing border-domain-influencing/30",
            domain === 'relationship' && "bg-domain-relationship-light text-domain-relationship border-domain-relationship/30",
            domain === 'strategic' && "bg-domain-strategic-light text-domain-strategic border-domain-strategic/30",
            className
        )}>
            {showLabel && label}
        </span>
    );
}
