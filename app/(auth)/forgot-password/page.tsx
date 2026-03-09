"use client"

import { useState } from "react"
import { NavigationLink } from "@/components/navigation-link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react"
import Image from "next/image"
import { useTranslation } from "@/components/language-provider"

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/auth/callback?next=/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError(t("auth.forgotPassword.errorOccurred"))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex">
        {/* Left Side - Visual */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
          <NavigationLink href="/" className="flex items-center space-x-3">
            <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
            <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
          </NavigationLink>

          <div className="space-y-6 text-white">
            <h1 className="text-4xl font-bold leading-tight">
              {t("auth.forgotPassword.checkEmailSideTitle")}
            </h1>
            <p className="text-lg text-white/90">
              {t("auth.forgotPassword.checkEmailSideDesc")}
            </p>
          </div>

          <div className="text-sm text-white/60">
            {t("common.copyright", { year: "2024" })}
          </div>
        </div>

        {/* Right Side - Success Message */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <NavigationLink href="/" className="inline-flex items-center space-x-3">
                <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
                <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
              </NavigationLink>
            </div>

            <Card className="border-border-subtle">
              <CardHeader className="space-y-1 pb-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-[#D4A853]/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-[#D4A853]" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-center">
                  {t("auth.forgotPassword.checkEmailTitle")}
                </CardTitle>
                <CardDescription className="text-base text-center">
                  {t("auth.forgotPassword.resetLinkSent")}
                </CardDescription>
                <p className="text-center font-medium text-foreground">{email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-surface-2 rounded-lg space-y-2">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t("auth.forgotPassword.clickLink")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("auth.forgotPassword.clickLinkDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 text-center space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {t("auth.forgotPassword.didntReceive")}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSuccess(false)
                      setEmail("")
                    }}
                  >
                    {t("auth.forgotPassword.tryAnotherEmail")}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex-col space-y-4">
                <NavigationLink
                  href="/login"
                  className="text-sm text-center w-full text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("auth.forgotPassword.backToLogin")}
                </NavigationLink>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F1629]/80 via-[#162044]/80 to-[#1A2550]/80 p-12 flex-col justify-between">
        <NavigationLink href="/" className="flex items-center space-x-3">
          <Image src="/gold-logo.svg" alt="Trading Hub" width={48} height={48} className="w-12 h-12" />
          <span className="font-bold text-2xl text-white">{t("common.brandName")}</span>
        </NavigationLink>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            {t("auth.forgotPassword.sideTitle")}
          </h1>
          <p className="text-lg text-white/90">
            {t("auth.forgotPassword.sideDesc")}
          </p>
        </div>

        <div className="text-sm text-white/60">
          {t("common.copyright", { year: "2024" })}
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <NavigationLink href="/" className="inline-flex items-center space-x-3">
              <Image src="/gold-logo.svg" alt="Trading Hub" width={40} height={40} className="w-10 h-10" />
              <span className="font-bold text-xl text-foreground">{t("common.brandName")}</span>
            </NavigationLink>
          </div>

          <Card className="border-border-subtle">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-3xl font-bold">{t("auth.forgotPassword.title")}</CardTitle>
              <CardDescription className="text-base">
                {t("auth.forgotPassword.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.forgotPassword.emailAddress")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("auth.forgotPassword.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-md">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("auth.forgotPassword.sending")}
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      {t("auth.forgotPassword.sendResetLink")}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
              <NavigationLink
                href="/login"
                className="text-sm text-center w-full text-muted-foreground hover:text-foreground flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.forgotPassword.backToLogin")}
              </NavigationLink>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
