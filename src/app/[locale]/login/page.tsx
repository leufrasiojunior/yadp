"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";


export default function LoginPage() {
    const t = useTranslations("Login");

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-background">
            <Card className="w-full max-w-md shadow-lg rounded-2xl bg-card text-card-foreground">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">
                        {t("title")}
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="password" className="pb-2.5 ">{t("password")}</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder={t("password_placeholder")}
                            value=''
                            onChange={() => console.log("Password changed")}
                        />
                    </div>

                </CardContent>

                <CardFooter>
                    <Button className="w-full" onClick={() => console.log("Login clicked")}>
                        {t("button")}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
