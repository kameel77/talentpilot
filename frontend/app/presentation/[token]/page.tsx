import PresentationContent from '@/components/PresentationContent';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Wizytówka Zespołu | TalentPilot',
    description: 'Profil mocnych stron zespołu',
};

export default async function PresentationPage({
    params
}: {
    params: Promise<{ token: string }>
}) {
    // Await params in Next.js 16
    const { token } = await params;
    return <PresentationContent token={token} />;
}
