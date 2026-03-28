
'use server';

import { revalidatePath } from 'next/cache';
import { createRecordId, queryAppDb, toIsoString } from '@/lib/app-db';

export type DomainStatus = {
    name: string;
    isAvailable: boolean;
    price: number;
    tld: string;
};

// This is a mock function. In a real application, you would use a domain registrar's API.
export async function checkDomain(domain: string): Promise<DomainStatus[]> {
    const tlds = ['.com', '.net', '.org', '.io', '.app', '.dev'];
    const baseName = domain.split('.')[0];

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const results: DomainStatus[] = tlds.map(tld => {
        const fullName = `${baseName}${tld}`;
        const isAvailable = Math.random() > 0.3; // 70% chance of being available
        let price = 12.99;
        if (tld === '.io') price = 39.99;
        if (tld === '.app' || tld === '.dev') price = 19.99;

        return {
            name: fullName,
            isAvailable: fullName.toLowerCase() === domain.toLowerCase() ? isAvailable : Math.random() > 0.5,
            price,
            tld,
        };
    });

    // Ensure the specifically searched domain is first in the list
    const searchedDomainIndex = results.findIndex(r => r.name.toLowerCase() === domain.toLowerCase());
    if (searchedDomainIndex > 0) {
        const [searchedDomain] = results.splice(searchedDomainIndex, 1);
        results.unshift(searchedDomain);
    }

    return results;
}

export type DNSRecord = {
    id: string;
    type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'AAAA' | 'NS';
    name: string;
    value: string;
    ttl: number;
};

export async function getDomainDNSRecords(domainId: string): Promise<DNSRecord[]> {
    try {
        // First, get the domain name from Postgres
        const domain = await getDomain(domainId);
        if (!domain) {
            console.error('Domain not found for ID:', domainId);
            return [];
        }

        // Fetch real DNS records from our API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:25683'}/api/dns/lookup?domain=${encodeURIComponent(domain.name)}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error('Failed to fetch DNS records:', response.statusText);
            return [];
        }

        const data = await response.json();
        return data.records || [];
    } catch (error) {
        console.error('Error fetching DNS records:', error);
        return [];
    }
}

export async function getDomainNameservers(domainId: string): Promise<string[]> {
    try {
        // First, get the domain name from Postgres
        const domain = await getDomain(domainId);
        if (!domain) {
            console.error('Domain not found for ID:', domainId);
            return [];
        }

        // Fetch real nameservers from our dedicated API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:25683'}/api/dns/nameservers?domain=${encodeURIComponent(domain.name)}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            console.error('Failed to fetch nameservers:', response.statusText);
            // Return default nameservers on error
            return [
                "ns1.neup.cloud",
                "ns2.neup.cloud",
                "ns3.neup.cloud",
                "ns4.neup.cloud",
            ];
        }

        const data = await response.json();
        return data.nameservers || [];
    } catch (error) {
        console.error('Error fetching nameservers:', error);
        // Return default nameservers on error
        return [
            "ns1.neup.cloud",
            "ns2.neup.cloud",
            "ns3.neup.cloud",
            "ns4.neup.cloud",
        ];
    }
}

export type ManagedDomain = {
    id: string;
    name: string;
    status: 'pending' | 'active' | 'error';
    addedAt: string;
    verificationCode?: string;
    verified?: boolean;
};

export async function addDomain(domainName: string) {
    if (!domainName) {
        throw new Error('Domain name cannot be empty.');
    }

    // Check if domain already exists
    const existing = await queryAppDb<{ id: string }>(`
      SELECT id
      FROM domains
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
    `, [domainName]);

    if (existing.rows.length > 0) {
        throw new Error(`Domain "${domainName}" has already been added.`);
    }

    // Generate a random 24-character verification code
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let verificationCode = '';
    for (let i = 0; i < 24; i++) {
        verificationCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    await queryAppDb(`
      INSERT INTO domains (
        id,
        name,
        status,
        "addedAt",
        "verificationCode",
        verified
      )
      VALUES ($1, $2, 'pending', NOW(), $3, FALSE)
    `, [createRecordId(), domainName, verificationCode]);

    revalidatePath('/domains');
}

export async function getDomains(): Promise<ManagedDomain[]> {
    const result = await queryAppDb<{
      id: string;
      name: string;
      status: 'pending' | 'active' | 'error';
      addedAt: Date;
      verificationCode: string | null;
      verified: boolean;
    }>(`
      SELECT id, name, status, "addedAt", "verificationCode", verified
      FROM domains
      ORDER BY name ASC
    `);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      addedAt: toIsoString(row.addedAt) || new Date().toISOString(),
      verificationCode: row.verificationCode ?? undefined,
      verified: row.verified,
    }));
}

export async function getDomain(id: string): Promise<ManagedDomain | null> {
    if (!id) return null;

    try {
        const result = await queryAppDb<{
          id: string;
          name: string;
          status: 'pending' | 'active' | 'error';
          addedAt: Date;
          verificationCode: string | null;
          verified: boolean;
        }>(`
          SELECT id, name, status, "addedAt", "verificationCode", verified
          FROM domains
          WHERE id = $1
          LIMIT 1
        `, [id]);

        const row = result.rows[0];
        if (!row) {
            return null;
        }

        return {
          id: row.id,
          name: row.name,
          status: row.status,
          addedAt: toIsoString(row.addedAt) || new Date().toISOString(),
          verificationCode: row.verificationCode ?? undefined,
          verified: row.verified,
        };
    } catch (error) {
        console.error("Error getting domain:", error);
        return null;
    }
}

export async function verifyDomain(domainId: string): Promise<{ success: boolean; message: string }> {
    try {
        const domain = await getDomain(domainId);
        if (!domain) {
            return { success: false, message: 'Domain not found' };
        }

        if (!domain.verificationCode) {
            return { success: false, message: 'No verification code found for this domain' };
        }

        // Call the verification API
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:25683'}/api/dns/verify?domain=${encodeURIComponent(domain.name)}&code=${encodeURIComponent(domain.verificationCode)}`,
            { cache: 'no-store' }
        );

        const data = await response.json();

        if (data.verified) {
            await queryAppDb(`
              UPDATE domains
              SET verified = TRUE, status = 'active'
              WHERE id = $1
            `, [domainId]);

            revalidatePath('/domains');
            revalidatePath(`/domains/${domainId}`);

            return { success: true, message: 'Domain verified successfully!' };
        } else {
            return {
                success: false,
                message: data.message || 'Verification failed. Please ensure the TXT record is added correctly.'
            };
        }
    } catch (error) {
        console.error('Error verifying domain:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to verify domain'
        };
    }
}

export async function deleteDomain(domainId: string): Promise<{ success: boolean; message: string }> {
    try {
        const domain = await getDomain(domainId);
        if (!domain) {
            return { success: false, message: 'Domain not found' };
        }

        await queryAppDb(`
          DELETE FROM domains
          WHERE id = $1
        `, [domainId]);

        revalidatePath('/domains');

        return { success: true, message: `Domain "${domain.name}" has been deleted successfully.` };
    } catch (error) {
        console.error('Error deleting domain:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to delete domain'
        };
    }
}
