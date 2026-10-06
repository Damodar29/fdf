SELECT
  issue_id,
  issue_title,
  COUNT(*) as crash_count
FROM `firebase_crashlytics.com_cpbs_bhajans_ANDROID`
WHERE
  application.display_version = '10.3.6'
GROUP BY issue_id, issue_title
ORDER BY crash_count DESC
LIMIT 10;
