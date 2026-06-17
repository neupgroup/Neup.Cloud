'use server';

import { cookies } from 'next/headers';
import { executeCommand } from '@/services/server/commands/server-command-service';
import { executeQuickCommand } from '@/services/server/commands/server-command-service';

async function resolveSelectedServerId(selectedServerId?: string | null) {
    const explicitServerId = selectedServerId?.trim();
    if (explicitServerId) {
        return explicitServerId;
    }

    const cookieStore = await cookies();
    return cookieStore.get('selected_server')?.value ?? null;
}

export async function getCertificates(selectedServerId?: string | null) {
    const serverId = await resolveSelectedServerId(selectedServerId);

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

export async function getCertificate(fileName: string, selectedServerId?: string | null) {
    const serverId = await resolveSelectedServerId(selectedServerId);

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

export async function deleteCertificate(fileName: string, selectedServerId?: string | null) {
    const serverId = await resolveSelectedServerId(selectedServerId);

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

export async function reissueCertificate(fileName: string, domain: string, selectedServerId?: string | null) {
    const serverId = await resolveSelectedServerId(selectedServerId);

    if (!serverId) {
        throw new Error("No server selected");
    }

    // Safety check on filename
    if (!fileName || fileName.includes('/') || fileName.includes('..') || !fileName.endsWith('.pem')) {
        throw new Error("Invalid certificate filename");
    }

    if (!domain || domain.trim() === '') {
        throw new Error("Domain is required");
    }

    const cleanDomain = domain.trim();
    const certName = fileName.replace('.pem', '');
    const sslDir = '/etc/nginx/ssl';
    const certPath = `${sslDir}/${certName}.pem`;
    const keyPath = `${sslDir}/${certName}.key`;

    /**
     * Reissuance Strategy:
     * 1. Delete the existing certificate (nginx/ssl files + certbot records)
     * 2. Issue a brand new certificate via certbot --standalone
     * 3. Copy the new cert into /etc/nginx/ssl, replacing the old one
     */
    const certbotCommand = `sudo certbot certonly --standalone --force-renewal --non-interactive --agree-tos -m encryption.cloud@neupgroup.com -d ${cleanDomain} --cert-name ${certName}`;

    const command = `
        # Step 1: Delete existing certificate files and certbot records
        sudo rm -f ${certPath}
        sudo rm -f ${keyPath}
        if sudo certbot certificates 2>/dev/null | grep -q "${certName}"; then
            sudo certbot delete --cert-name ${certName} --non-interactive
        else
            sudo rm -rf /etc/letsencrypt/live/${certName}
            sudo rm -rf /etc/letsencrypt/archive/${certName}
            sudo rm -f /etc/letsencrypt/renewal/${certName}.conf
        fi

        # Step 2: Stop Nginx to free port 80 for standalone certbot
        sudo systemctl stop nginx

        # Step 3: Issue a fresh certificate
        ${certbotCommand} 2>&1
        CERTBOT_EXIT=$?

        if [ $CERTBOT_EXIT -eq 0 ]; then
            # Step 4: Copy new cert into /etc/nginx/ssl
            sudo cp -L /etc/letsencrypt/live/${certName}/fullchain.pem ${certPath} && \
            sudo cp -L /etc/letsencrypt/live/${certName}/privkey.pem ${keyPath} && \
            sudo chmod 644 ${certPath} && \
            sudo chmod 600 ${keyPath}
            echo "SUCCESS: Certificate reissued successfully for ${cleanDomain}"
        else
            echo "ERROR: Certbot failed to issue certificate for ${cleanDomain}"
        fi

        # Step 5: Restart Nginx regardless of outcome
        sudo systemctl start nginx || true

        exit $CERTBOT_EXIT
    `;

    try {
        const result = await executeCommand(
            serverId,
            command,
            `Reissue Certificate: ${cleanDomain}`,
            certbotCommand,
            `webservices:cert:reinstall`
        );

        if (result.error) {
            throw new Error(`Reissuance failed: ${result.error}`);
        }

        const output = result.output || '';
        if (output.includes("ERROR")) {
            throw new Error(output.substring(output.indexOf("ERROR")));
        }

        return { success: true, output };
    } catch (err: any) {
        throw err;
    }
}
