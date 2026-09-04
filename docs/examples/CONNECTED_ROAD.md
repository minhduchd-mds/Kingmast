# Connected-road provider example

`connected-road-provider.example.json` is an integration shape example only. Before replaying it against `/connected-road/provider`, replace `timestampMs`, SPaT end times and hazard expiry times with current epoch-millisecond values. KINGMAST intentionally rejects stale or implausibly future connected-road data.

Use the configured `x-kingmast-edge-token` header when `KINGMAST_EDGE_TOKEN` is set.
