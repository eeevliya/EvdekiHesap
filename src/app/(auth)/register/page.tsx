import { RegisterForm } from './register-form'

interface Props {
  searchParams: Promise<{ invite?: string }>
}

export default async function RegisterPage({ searchParams }: Props) {
  const { invite } = await searchParams
  return <RegisterForm inviteCode={invite ?? null} />
}
