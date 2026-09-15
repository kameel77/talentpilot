import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PublicPresentation from '@/components/presentation/PublicPresentation';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('teams');
    return {
        title: `${t('presentationBadge')} | TalentPilot`,
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function PresentationPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    return <PublicPresentation token={token} />;
}
