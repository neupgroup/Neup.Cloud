export interface SystemSectionProps {
    application: any;
    selectedServerId?: string | null;
}

export function useSystemSection(application: any) {
    const uniquePorts = application.networkAccess?.map(String).filter((p: string) => p && p !== "NaN") || [];
    const portsDescription = uniquePorts.length > 0 ? uniquePorts.join(', ') : "No ports exposed";

    const location = application.location || '';
    const errorfileRaw: string = application.information?.errorfile || '';

    const resolveLogPath = (filename: string) => {
        if (!location) return filename;
        return location.endsWith('/') ? `${location}${filename}` : `${location}/${filename}`;
    };

    const outputLogPath = resolveLogPath('terminal.output.log');
    const errorLogPath = errorfileRaw
        ? (errorfileRaw.startsWith('/') ? errorfileRaw : resolveLogPath(errorfileRaw))
        : resolveLogPath('terminal.error.log');

    return { portsDescription, outputLogPath, errorLogPath };
}
