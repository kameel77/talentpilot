import { GallupDomain } from '@/lib/gallup-data';
export type DomainType = GallupDomain;
import { DOMAIN_LABELS } from '@/lib/gallup-data';
import { cn } from '@/lib/utils';

interface DomainBadgeProps {
    domain: string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

export function DomainBadge({ domain, size = 'md', showLabel = true, className }: DomainBadgeProps) {
    if (!domain) return null;

    const label = DOMAIN_LABELS[domain as GallupDomain]?.pl || domain;

    return (
        <span
            className={cn(
                "inline-flex items-center rounded font-bold border uppercase tracking-wider whitespace-nowrap",
                size === 'sm' && "px-2.5 py-0.5 text-[11px]",
                size === 'md' && "px-3 py-1 text-xs",
                size === 'lg' && "px-3.5 py-1.5 text-sm",
                domain === 'executing' && "bg-domain-executing-light text-domain-executing border-domain-executing/30",
                domain === 'influencing' && "bg-domain-influencing-light text-domain-influencing border-domain-influencing/30",
                domain === 'relationship_building' && "bg-domain-relationship-light text-domain-relationship border-domain-relationship/30",
                domain === 'strategic_thinking' && "bg-domain-strategic-light text-domain-strategic border-domain-strategic/30",
                className
            )}
        >
            {showLabel && label}
        </span>
    );
}
