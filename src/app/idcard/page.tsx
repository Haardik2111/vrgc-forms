import { redirect } from 'next/navigation';

export default function IDCardRedirect() {
  redirect('/?tab=idcard');
}
