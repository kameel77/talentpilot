"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { tokenManager } from "@/lib/api";

export function useRoleLabels() {
    const t = useTranslations("roleLabels");
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRole(tokenManager.getUser()?.role ?? null);
    }, []);

    const isCoach = role === "coach";

    return {
        isCoach,
        role,
        orgsLabel: isCoach ? t("clients") : t("orgs"),
        usersLabel: isCoach ? t("clientsIndividual") : t("users"),
        teamsLabel: isCoach ? t("coachTeams") : t("teams"),
        inviteLabel: isCoach ? t("addClient") : t("inviteUser"),
        addPersonLabel: isCoach ? t("addPerson") : t("inviteUser"),
    };
}
