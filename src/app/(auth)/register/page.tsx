'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Hesap oluştur</CardTitle>
          <CardDescription>
            Aile portföyünüzü takip etmek için kayıt olun
          </CardDescription>
        </CardHeader>
        <form action={action}>
          <CardContent className="space-y-4">
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Ad Soyad</Label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="Ahmet Yılmaz"
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kayıt ol'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Zaten hesabınız var mı?{' '}
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Giriş yap
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
