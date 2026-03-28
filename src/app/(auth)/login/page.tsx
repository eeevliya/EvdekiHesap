import { LoginForm } from './login-form'

interface Props {
  searchParams: Promise<{ invite?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { invite } = await searchParams
  return <LoginForm inviteCode={invite ?? null} />
}
