import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
