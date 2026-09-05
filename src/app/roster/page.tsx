import { redirect } from 'next/navigation';

export default function RosterRedirect() {
  redirect('/?tab=members');
}
