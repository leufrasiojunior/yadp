'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'


export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-background">
            <Card className="w-full max-w-md shadow-lg rounded-2xl bg-card text-card-foreground">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-bold">Login</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="login">login</Label>
                        <Input id="login" type="text" placeholder="login" />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="password">Senha</Label>
                        <Input id="password" type="password" placeholder="••••••••" />
                    </div>

                    <div className="text-right text-sm">
                        <a href="/forgot-password" className="text-blue-600 hover:underline">
                            Esqueceu a senha?
                        </a>
                    </div>
                </CardContent>

                <CardFooter>
                    <Button className="w-full">Entrar</Button>
                </CardFooter>
            </Card>
        </div>
    )
}

