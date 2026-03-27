const { bbFetchAll } = require('../_shared/bb-client');

function isActiveTerm(term) {
  if (term.availability?.available !== 'Yes') return false;
  if (!term.startDate && !term.endDate) return true;
  const now = Date.now();
  const start = term.startDate ? new Date(term.startDate).getTime() : -Infinity;
  const end = term.endDate ? new Date(term.endDate).getTime() : Infinity;
  return now >= start && now <= end;
}

module.exports = async function (context, req) {
  try {
    const all = await bbFetchAll('/learn/api/public/v1/terms?limit=100');
    const terms = all.filter(isActiveTerm).map(t => ({
      id: t.id,
      name: t.name,
      startDate: t.startDate || null,
      endDate: t.endDate || null,
    }));
    context.res = { status: 200, body: { terms } };
  } catch (err) {
    context.log('Error fetching terms:', err.message);
    context.res = { status: 500, body: { error: 'Failed to fetch terms' } };
  }
};
