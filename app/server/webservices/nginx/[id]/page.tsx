'use client';

import React, { use } from 'react';
import NginxConfigEditor from '@/components/webservices/nginx/NginxConfigEditor';

export default function NginxConfigPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);

    // If id is 'new', we pass undefined or 'new', handled by the component
    // The component expects configId to be optional string. 
    // If id is "new", we can pass "new" or nothing if we want it to be cleaner, 
    // but looking at component logic: `const isNew = !configId || configId === 'new';`
    // So passing "new" is perfectly fine.

    return <NginxConfigEditor configId={id} />;
}
