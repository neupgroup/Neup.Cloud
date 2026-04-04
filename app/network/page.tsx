import { redirect } from 'next/navigation';

export default function NetworkPage() {
	redirect('/server/firewall/network');
}

