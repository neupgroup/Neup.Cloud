/*
::neup.documentation::server-firewall-rules

Server firewall rule helpers used by firewall services and network UI surfaces.

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
