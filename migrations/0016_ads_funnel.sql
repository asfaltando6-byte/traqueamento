CREATE TABLE IF NOT EXISTS tracking_events (
 event_id TEXT PRIMARY KEY, visit_id TEXT NOT NULL, event_type TEXT NOT NULL,
 origin TEXT NOT NULL, path TEXT NOT NULL, utm_source TEXT, utm_campaign TEXT,
 utm_content TEXT, utm_term TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracking_events_time ON tracking_events(created_at,event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_ad ON tracking_events(utm_content,created_at);
CREATE TABLE IF NOT EXISTS metrics_state (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta_ads (
 snapshot_id TEXT NOT NULL, ad_id TEXT NOT NULL, name TEXT, campaign_id TEXT,
 campaign_name TEXT, adset_id TEXT, adset_name TEXT, effective_status TEXT,
 thumbnail_url TEXT, synced_at INTEGER NOT NULL, PRIMARY KEY(snapshot_id,ad_id)
);
CREATE TABLE IF NOT EXISTS meta_ad_daily (
 snapshot_id TEXT NOT NULL, date TEXT NOT NULL, ad_id TEXT NOT NULL,
 campaign_id TEXT NOT NULL, campaign_name TEXT, ad_name TEXT,
 currency TEXT NOT NULL, spend_cents INTEGER NOT NULL DEFAULT 0,
 impressions INTEGER NOT NULL DEFAULT 0, link_clicks INTEGER NOT NULL DEFAULT 0,
 synced_at INTEGER NOT NULL, PRIMARY KEY(snapshot_id,date,ad_id)
);
CREATE TABLE IF NOT EXISTS meta_day_snapshots (date TEXT PRIMARY KEY,snapshot_id TEXT NOT NULL);
