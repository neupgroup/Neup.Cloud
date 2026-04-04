import { redirect } from 'next/navigation';

export default function Page() {
    redirect('/commands/create?mode=set');
}
