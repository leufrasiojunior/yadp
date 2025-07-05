"use client";

import { useLocaleSwitcher } from "@/hooks/useLocaleSwitcher";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    Command,
    CommandList,
    CommandGroup,
    CommandItem,
    CommandEmpty,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function LanguageSwitcher() {
    const { languages, value, changeLocale } = useLocaleSwitcher();
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                    {/* {languages.find((l) => l.value === value)?.emoji} */}
                    {languages.find((l) => l.value === value)?.label}
                    <ChevronsUpDown className="opacity-50 ml-2" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandList>
                        <CommandEmpty>Não encontrado.</CommandEmpty>
                        <CommandGroup>
                            {languages.map((lang) => (
                                <CommandItem
                                    key={lang.value}
                                    value={lang.value}
                                    onSelect={(current) => {
                                        changeLocale(current);
                                        setOpen(false);
                                    }}
                                    className="flex items-center"
                                >
                                    {/* <span className="mr-2">{lang.emoji}</span> */}
                                    {lang.label}
                                    <Check
                                        className={cn(
                                            "ml-auto",
                                            value === lang.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
