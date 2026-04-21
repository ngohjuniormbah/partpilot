module.exports = async (req, res) => {
  const raw = process.env.DATABASE_URL || '';
  const masked = raw.replace(/:(.*?)@/, ':****@');

  return res.status(200).json({
    hasDatabaseUrl: Boolean(raw),
    startsWith: masked.slice(0, 80),
    containsProjectScopedUser: raw.includes('postgres.oplvsrqhnggbajthoqii'),
    containsPlainPostgresUser: raw.includes('postgres:')
  });
};