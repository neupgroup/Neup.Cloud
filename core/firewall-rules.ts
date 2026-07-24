/*
::neup.documentation::core-firewall-rules

Shared firewall rule helpers used by firewall services and UI surfaces to keep
protected network rule behavior consistent.

::end
*/

type FirewallRuleLike = {
    to: string;
    action: string;
};

export function isSshAllowRule(rule: FirewallRuleLike): boolean {
    const to = rule.to.toLowerCase().replace(/\(v6\)/g, '').trim();
    const action = rule.action.toUpperCase();
    const isAllowingAction = action.includes('ALLOW') || action.includes('LIMIT');

    return isAllowingAction && (to === '22' || to === '22/tcp' || to === 'ssh' || to === 'openssh');
}
