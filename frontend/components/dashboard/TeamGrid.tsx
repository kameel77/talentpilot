"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import TalentBadge from "./TalentBadge";

interface TeamMemberTalent {
    name: string;
    domain: string;
    description?: string;
}

interface TeamMember {
    id: number | string;
    full_name: string;
    role?: string;
    talents?: TeamMemberTalent[];
}

const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (index: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: index * 0.05, duration: 0.3 },
    }),
};

export default function TeamGrid({ members }: { members: TeamMember[] }) {
    const t = useTranslations('teams');

    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member, index) => (
                <motion.div
                    key={member.id}
                    custom={index}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                {member.full_name}
                            </h3>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                {member.role || t('teamMemberRole')}
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-100 text-sm font-semibold text-slate-500 flex items-center justify-center">
                            {member.full_name
                                .split(" ")
                                .map((chunk) => chunk[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {member.talents && member.talents.length > 0 ? (
                            member.talents.map((talent) => (
                                <TalentBadge
                                    key={`${member.id}-${talent.name}`}
                                    name={talent.name}
                                    domain={talent.domain}
                                    description={talent.description}
                                />
                            ))
                        ) : (
                            <span className="text-sm text-slate-500">
                                {t('noTalentsAssigned')}
                            </span>
                        )}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
