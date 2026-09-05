import { redirect } from 'next/navigation';

export default function PlannedEventsRedirect() {
  redirect('/?tab=planned_events');
}
