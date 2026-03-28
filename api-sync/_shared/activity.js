const STATUS_RANK = { inactive: 2, 'at-risk': 1, active: 0 };

function computeStatus(lastAccessedDate) {
  if (!lastAccessedDate) return 'inactive';
  const daysSince = Math.floor(
    (Date.now() - new Date(lastAccessedDate).getTime()) / 86400000
  );
  const atRiskDays = parseInt(process.env.BB_AT_RISK_DAYS || '8', 10);
  const inactiveDays = parseInt(process.env.BB_INACTIVE_DAYS || '15', 10);
  if (daysSince >= inactiveDays) return 'inactive';
  if (daysSince >= atRiskDays) return 'at-risk';
  return 'active';
}

function worstStatus(statuses) {
  return statuses.reduce(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'active'
  );
}

module.exports = { computeStatus, worstStatus };
