'use server';

import { cookies } from 'next/headers';
import { executeQuickCommand } from '@/app/server/commands/actions';

export async function getCertificates() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        throw new Error("No server selected");
    }

    // Command to list certificates in /etc/nginx/ssl
    // We assume .pem files are certs. We can use openssl to get details.
    // For now, let's just list the files and maybe their dates.
    // Using a simple ls format to parse easily.
    const command = `
        if [ -d /etc/nginx/ssl ]; then
            for f in /etc/nginx/ssl/*.pem; do
                [ -e "$f" ] || continue
                echo "File: $(basename "$f")"
                openssl x509 -in "$f" -noout -dates -subject -issuer
                echo "---"
            done
        else
            echo "No SSL directory found."
        fi
    `;

    const result = await executeQuickCommand(serverId, command);

    if (result.error) {
        throw new Error(result.error);
    }

    const output = result.output || '';
    if (output.includes("No SSL directory found")) {
        return [];
    }

    // Parse the output
    const certs: any[] = [];
    const chunks = output.split('---');

    for (const chunk of chunks) {
        if (!chunk.trim()) continue;

        const fileNameMatch = chunk.match(/File: (.*)/);
        const fileName = fileNameMatch ? fileNameMatch[1] : '';

        const notBeforeMatch = chunk.match(/notBefore=(.*)/);
        const notBefore = notBeforeMatch ? notBeforeMatch[1] : '';

        const notAfterMatch = chunk.match(/notAfter=(.*)/);
        const notAfter = notAfterMatch ? notAfterMatch[1] : '';

        const subjectMatch = chunk.match(/subject=(.*)/);
        const subject = subjectMatch ? subjectMatch[1] : '';

        const issuerMatch = chunk.match(/issuer=(.*)/);
        const issuer = issuerMatch ? issuerMatch[1] : '';

        // Extract Common Name (CN)
        const cnMatch = subject.match(/CN\s*=\s*([^,]+)/);
        const commonName = cnMatch ? cnMatch[1] : subject;

        if (fileName) {
            certs.push({
                fileName,
                commonName,
                notBefore,
                notAfter,
                issuer,
                validUntil: notAfter ? new Date(notAfter).toISOString() : null
            });
        }
    }

    return certs;
}

export async function getCertificate(fileName: string) {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        throw new Error("No server selected");
    }

    if (!fileName || fileName.includes('/') || fileName.includes('..')) {
        throw new Error("Invalid filename");
    }

    const filePath = `/etc/nginx/ssl/${fileName}`;
    const command = `
        if [ -f "${filePath}" ]; then
            echo "EXISTS"
            openssl x509 -in "${filePath}" -noout -dates -subject -issuer -fingerprint -serial
            echo "---TEXT---"
            openssl x509 -in "${filePath}" -noout -text
        else
            echo "NOT_FOUND"
        fi
    `;

    const result = await executeQuickCommand(serverId, command);

    if (result.error) {
        throw new Error(result.error);
    }

    const output = result.output || '';
    if (output.includes("NOT_FOUND")) {
        return null;
    }

    const parts = output.split("---TEXT---");
    const basicInfo = parts[0] || '';
    const textInfo = parts[1] || '';

    const notBeforeMatch = basicInfo.match(/notBefore=(.*)/);
    const notAfterMatch = basicInfo.match(/notAfter=(.*)/);
    const subjectMatch = basicInfo.match(/subject=(.*)/);
    const issuerMatch = basicInfo.match(/issuer=(.*)/);
    const fingerprintMatch = basicInfo.match(/fingerprint=(.*)/);
    const serialMatch = basicInfo.match(/serial=(.*)/);

    const cnMatch = (subjectMatch ? subjectMatch[1] : '').match(/CN\s*=\s*([^,]+)/);
    const commonName = cnMatch ? cnMatch[1] : (subjectMatch ? subjectMatch[1] : 'Unknown');

    // Extract SANs from text info
    const sanMatch = textInfo.match(/X509v3 Subject Alternative Name:\s*(?:critical)?\s*([^\n]*)/);
    const sans = sanMatch ? sanMatch[1].trim().split(', ').map(s => s.replace('DNS:', '')) : [];

    return {
        fileName,
        commonName,
        subject: subjectMatch ? subjectMatch[1] : '',
        issuer: issuerMatch ? issuerMatch[1] : '',
        notBefore: notBeforeMatch ? notBeforeMatch[1] : '',
        notAfter: notAfterMatch ? notAfterMatch[1] : '',
        fingerprint: fingerprintMatch ? fingerprintMatch[1] : '',
        serial: serialMatch ? serialMatch[1] : '',
        validUntil: notAfterMatch ? new Date(notAfterMatch[1]).toISOString() : null,
        sans,
        fullText: textInfo.trim()
    };
}

export async function deleteCertificate(fileName: string) {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;

    if (!serverId) {
        throw new Error("No server selected");
    }

    // Safety check on filename
    if (!fileName || fileName.includes('/') || fileName.includes('..') || !fileName.endsWith('.pem')) {
        throw new Error("Invalid certificate filename");
    }

    // We assume fileName is like "example.com.pem". 
    // The key would be "example.com.key".
    // The Certbot name is likely "example.com" if we followed our own convention.
    const certName = fileName.replace('.pem', '');
    const certNameKey = `${certName}.key`;
    const certNamePem = `${certName}.pem`;

    /**
     * Deletion Strategy:
     * 1. Remove local copies in /etc/nginx/ssl
     * 2. Use 'certbot delete' to properly remove from Let's Encrypt renewal logic (live/archive/renew params)
     * 3. Fallback manual cleanup if certbot fails or if they were manual files
     */
    const command = `
        # 1. Remove files in /etc/nginx/ssl
        sudo rm -f /etc/nginx/ssl/${certNamePem}
        sudo rm -f /etc/nginx/ssl/${certNameKey}
        
        # 2. Try Certbot delete
        if sudo certbot certificates | grep -q "${certName}"; then
            echo "Removing from Certbot..."
            sudo certbot delete --cert-name ${certName} --non-interactive
        else
            echo "Certbot certificate '${certName}' not found. Manual cleanup..."
            # Manual cleanup if not managed by certbot or name mismatch
            sudo rm -rf /etc/letsencrypt/live/${certName}
            sudo rm -rf /etc/letsencrypt/archive/${certName}
            sudo rm -f /etc/letsencrypt/renewal/${certName}.conf
        fi
        
        echo "Certificate deletion complete."
    `;

    const result = await executeQuickCommand(serverId, command);

    if (result.error) {
        throw new Error(`Deletion failed: ${result.error}`);
    }

    return { success: true, output: result.output };
}
