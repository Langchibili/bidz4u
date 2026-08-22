export const dynamic = 'force-dynamic';

import AuthLayoutClient from './AuthLayoutClient';

export default function AuthLayout({ children }) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>;
}
