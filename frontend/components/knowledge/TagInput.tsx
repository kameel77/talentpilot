"use client";

import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
    label: string;
    placeholder?: string;
    tags: string[];
    suggestions?: string[];
    onChange: (tags: string[]) => void;
    className?: string;
}

export function TagInput({
    label,
    placeholder = "Dodaj tag i naciśnij Enter",
    tags,
    suggestions = [],
    onChange,
    className,
}: TagInputProps) {
    const [draft, setDraft] = useState("");

    const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);

    const handleAdd = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (normalizedTags.includes(trimmed)) {
            setDraft("");
            return;
        }
        onChange([...normalizedTags, trimmed]);
        setDraft("");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            handleAdd(draft);
        }
    };

    const handleRemove = (tagToRemove: string) => {
        onChange(normalizedTags.filter((tag) => tag !== tagToRemove));
    };

    const trimmedSuggestions = suggestions.filter(
        (suggestion) => suggestion && !normalizedTags.includes(suggestion)
    );

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">{label}</label>
                {normalizedTags.length > 0 && (
                    <span className="text-xs text-slate-400">{normalizedTags.length} tagów</span>
                )}
            </div>
            <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="bg-white"
            />
            {normalizedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {normalizedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-2 bg-slate-100 text-slate-600">
                            {tag}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-slate-400 hover:text-slate-600"
                                onClick={() => handleRemove(tag)}
                            >
                                ×
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}
            {trimmedSuggestions.length > 0 && (
                <div className="text-xs text-slate-400">
                    Sugestie: {trimmedSuggestions.slice(0, 6).join(", ")}
                </div>
            )}
        </div>
    );
}
