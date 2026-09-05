import { redirect } from 'next/navigation';

export default function EventsRedirect() {
  redirect('/?tab=planned_events');
}
